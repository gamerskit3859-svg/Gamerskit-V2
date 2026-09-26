"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, CONTACT_CHANNEL_TYPES } from "@/lib/api";
import type {
  ContactChannelAdmin,
  ContactChannelInput,
  ContactChannelType,
} from "@/lib/api";
import { clearAdminToken, getAdminToken } from "@/lib/admin-token";
import { Button, Card, FieldLabel, Input, Select } from "@/components/ui";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

// Per-type copy: what the admin should type into "value", and a sensible
// starting label so adding WhatsApp is a couple of keystrokes.
const TYPE_META: Record<
  ContactChannelType,
  { label: string; defaultLabel: string; defaultDescription: string; hint: string }
> = {
  whatsapp: {
    label: "WhatsApp",
    defaultLabel: "WhatsApp",
    defaultDescription: "Chat with us",
    hint: "Phone number, e.g. 01303775977 or 8801303775977",
  },
  messenger: {
    label: "Messenger",
    defaultLabel: "Messenger",
    defaultDescription: "Message on Facebook",
    hint: "Page username, e.g. gamerskit.gg",
  },
  telegram: {
    label: "Telegram",
    defaultLabel: "Telegram",
    defaultDescription: "Message on Telegram",
    hint: "Username, e.g. gamerskit",
  },
  instagram: {
    label: "Instagram",
    defaultLabel: "Instagram",
    defaultDescription: "DM on Instagram",
    hint: "Username, e.g. gamerskit.gg",
  },
  phone: {
    label: "Phone call",
    defaultLabel: "Call us",
    defaultDescription: "Talk to support",
    hint: "Phone number, e.g. 01537-428371",
  },
  email: {
    label: "Email",
    defaultLabel: "Email",
    defaultDescription: "Send us an email",
    hint: "Address, e.g. hello@gamerskit.gg",
  },
  custom: {
    label: "Custom link",
    defaultLabel: "",
    defaultDescription: "",
    hint: "Full URL, e.g. https://gamerskit.gg/help",
  },
};

type Draft = {
  type: ContactChannelType;
  label: string;
  description: string;
  value: string;
  order: number;
  isActive: boolean;
};

const blank = (): Draft => ({
  type: "whatsapp",
  label: TYPE_META.whatsapp.defaultLabel,
  description: TYPE_META.whatsapp.defaultDescription,
  value: "",
  order: 0,
  isActive: true,
});

const toDraft = (c: ContactChannelAdmin): Draft => ({
  type: c.type,
  label: c.label,
  description: c.description ?? "",
  value: c.value,
  order: c.order ?? 0,
  isActive: c.isActive !== false,
});

const toPayload = (d: Draft): ContactChannelInput => ({
  type: d.type,
  label: d.label.trim(),
  description: d.description.trim(),
  value: d.value.trim(),
  order: d.order,
  isActive: d.isActive,
});

export default function AdminContactPage() {
  const router = useRouter();
  const [items, setItems] = useState<ContactChannelAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState<Draft>(blank());
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  useEffect(() => {
    let cancelled = false;
    const token = getAdminToken();
    if (!token) {
      clearAdminToken();
      router.replace("/admin");
      return;
    }
    void (async () => {
      try {
        const r = await api.listContactChannelsAdmin(token);
        if (cancelled) return;
        setItems(r.items);
        setDrafts(
          Object.fromEntries(r.items.map((c) => [c._id, toDraft(c)])),
        );
      } catch (err) {
        const status = (err as Error & { status?: number })?.status;
        if (status === 401 || status === 403) {
          clearAdminToken();
          router.replace("/admin");
          return;
        }
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Switching type refills the label/description, but only while they still
  // hold the previous type's defaults — never over something hand-written.
  function applyType(draft: Draft, type: ContactChannelType): Draft {
    const previous = TYPE_META[draft.type];
    const next = TYPE_META[type];
    return {
      ...draft,
      type,
      label:
        draft.label === previous.defaultLabel ? next.defaultLabel : draft.label,
      description:
        draft.description === previous.defaultDescription
          ? next.defaultDescription
          : draft.description,
    };
  }

  async function create() {
    const token = getAdminToken();
    if (!token) return;
    const payload = toPayload(creating);
    if (!payload.label || !payload.value) {
      setNotice("A channel needs both a label and a value.");
      return;
    }
    setBusy("create");
    setNotice(null);
    try {
      const r = await api.createContactChannel(payload, token);
      setItems((prev) => [...prev, r.item]);
      setDrafts((prev) => ({ ...prev, [r.item._id]: toDraft(r.item) }));
      setCreating(blank());
      setNotice(`Added ${r.item.label}.`);
    } catch (err) {
      setNotice(`Could not add the channel: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function saveChannel(id: string) {
    const token = getAdminToken();
    if (!token) return;
    const draft = drafts[id];
    if (!draft) return;
    const payload = toPayload(draft);
    if (!payload.label || !payload.value) {
      setNotice("A channel needs both a label and a value.");
      return;
    }
    setBusy(id);
    setNotice(null);
    try {
      const r = await api.updateContactChannel(id, payload, token);
      setItems((prev) => prev.map((c) => (c._id === id ? r.item : c)));
      setDrafts((prev) => ({ ...prev, [id]: toDraft(r.item) }));
      setNotice(`Saved ${r.item.label}.`);
    } catch (err) {
      setNotice(`Could not save: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  async function removeChannel(channel: ContactChannelAdmin) {
    const token = getAdminToken();
    if (!token) return;
    if (
      !window.confirm(
        `Remove "${channel.label}" from the storefront contact widget?`,
      )
    ) {
      return;
    }
    setBusy(channel._id);
    setNotice(null);
    try {
      await api.deleteContactChannel(channel._id, token);
      setItems((prev) => prev.filter((c) => c._id !== channel._id));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[channel._id];
        return next;
      });
      setNotice(`Removed ${channel.label}.`);
    } catch (err) {
      setNotice(`Could not remove: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  function fields(
    draft: Draft,
    onChange: (next: Draft) => void,
    disabled: boolean,
  ) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldLabel label="Channel">
          <Select
            value={draft.type}
            disabled={disabled}
            onChange={(e) =>
              onChange(applyType(draft, e.target.value as ContactChannelType))
            }
          >
            {CONTACT_CHANNEL_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_META[type].label}
              </option>
            ))}
          </Select>
        </FieldLabel>
        <FieldLabel label="Value" hint={TYPE_META[draft.type].hint}>
          <Input
            value={draft.value}
            disabled={disabled}
            placeholder={TYPE_META[draft.type].hint}
            onChange={(e) => onChange({ ...draft, value: e.target.value })}
          />
        </FieldLabel>
        <FieldLabel label="Label" hint="Shown as the bold line in the widget">
          <Input
            value={draft.label}
            disabled={disabled}
            onChange={(e) => onChange({ ...draft, label: e.target.value })}
          />
        </FieldLabel>
        <FieldLabel label="Description" hint="Optional smaller line beneath it">
          <Input
            value={draft.description}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...draft, description: e.target.value })
            }
          />
        </FieldLabel>
        <FieldLabel label="Order" hint="Lower numbers appear first">
          <Input
            type="number"
            min={0}
            value={draft.order}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...draft, order: Number(e.target.value) || 0 })
            }
          />
        </FieldLabel>
        <label className="flex items-end gap-2 pb-2.5 text-sm">
          <input
            type="checkbox"
            checked={draft.isActive}
            disabled={disabled}
            onChange={(e) => onChange({ ...draft, isActive: e.target.checked })}
          />
          <span>
            <span className="font-medium">Show on the storefront</span>
            <span className="block text-xs text-fg-muted">
              Uncheck to hide it without deleting it.
            </span>
          </span>
        </label>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Contact channels"
        description={
          <span className="block max-w-2xl">
            These fill the floating “Get in touch” widget on the storefront. Type
            a plain phone number or username — the link is built for you. With no
            active channels the widget does not appear at all.
          </span>
        }
      >
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {notice && (
          <div className="mt-3 rounded-lg border border-line bg-white px-4 py-3 text-sm text-fg-soft">
            {notice}
          </div>
        )}
      </AdminPageHeader>

      <Card padding="lg" className="mb-4 sm:mb-6">
        <h2 className="mb-4 text-lg font-semibold">Add a channel</h2>
        {fields(creating, setCreating, busy === "create")}
        <div className="mt-4 flex justify-end">
          <Button
            className="!w-full sm:!w-auto"
            disabled={busy === "create"}
            onClick={create}
          >
            {busy === "create" ? "Adding…" : "Add channel"}
          </Button>
        </div>
      </Card>

      {loading ? (
        <Card padding="lg">
          <p className="text-sm text-fg-muted">Loading…</p>
        </Card>
      ) : items.length === 0 ? (
        <Card padding="lg">
          <p className="text-sm text-fg-muted">
            No contact channels yet. Add one above and it appears on the
            storefront straight away.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((channel) => {
            const draft = drafts[channel._id];
            if (!draft) return null;
            const disabled = busy === channel._id;
            const dirty =
              JSON.stringify(toPayload(draft)) !==
              JSON.stringify(toPayload(toDraft(channel)));
            return (
              <Card key={channel._id} padding="lg">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold">
                    {channel.label || TYPE_META[channel.type].label}
                    {!channel.isActive && (
                      <span className="ml-2 rounded-full bg-bg-soft px-2 py-0.5 text-[11px] font-medium text-fg-muted">
                        Hidden
                      </span>
                    )}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    onClick={() => removeChannel(channel)}
                  >
                    Remove
                  </Button>
                </div>
                {fields(
                  draft,
                  (next) =>
                    setDrafts((prev) => ({ ...prev, [channel._id]: next })),
                  disabled,
                )}
                <div className="mt-4 flex items-center justify-end gap-2">
                  {dirty && !disabled && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setDrafts((prev) => ({
                          ...prev,
                          [channel._id]: toDraft(channel),
                        }))
                      }
                    >
                      Discard
                    </Button>
                  )}
                  <Button
                    size="sm"
                    disabled={disabled || !dirty}
                    onClick={() => saveChannel(channel._id)}
                  >
                    {disabled ? "Saving…" : "Save"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
