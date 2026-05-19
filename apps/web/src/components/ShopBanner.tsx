import { api } from "@/lib/api";
import type { ShopBannerItem } from "@/lib/api";
import { ShopBannerSlider } from "@/components/ShopBannerSlider";

export function ShopBannerLoading() {
  return (
    <section className="mx-auto w-full max-w-[1280px] overflow-hidden px-5 pb-5 pt-5 sm:pt-6 lg:px-8">
      <div
        className="aspect-[16/7] w-full animate-pulse rounded-lg bg-bg-soft md:aspect-[16/5] lg:aspect-[16/4]"
        aria-label="Loading shop banners"
      />
    </section>
  );
}

export function ShopBannerError() {
  return (
    <section className="mx-auto w-full max-w-[1280px] overflow-hidden px-5 pb-5 pt-3 lg:px-8">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Could not load the shop banners.
      </div>
    </section>
  );
}

export async function ShopBanner() {
  let banners: ShopBannerItem[] = [];

  try {
    const result = await api.getShopBanners();
    banners = result.items;
  } catch {
    return <ShopBannerError />;
  }

  if (banners.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-[1280px] overflow-hidden px-5 pb-5 pt-5 sm:pt-6 lg:px-8">
      <ShopBannerSlider banners={banners} />
    </section>
  );
}
