import Image from "next/image";
import { api, type ShopBannerSettings } from "@/lib/api";
import { optimizeCloudinaryImage } from "@/lib/images";

export function ShopBannerLoading() {
  return (
    <section className="mx-auto -mt-[86px] w-full max-w-[1280px] px-5 pb-5 lg:px-8">
      <div
        className="aspect-[16/7] w-full animate-pulse rounded-lg bg-bg-soft md:aspect-[16/5] lg:aspect-[16/4]"
        aria-label="Loading shop banner"
      />
    </section>
  );
}

export function ShopBannerError() {
  return (
    <section className="mx-auto w-full max-w-[1280px] px-5 pb-5 pt-3 lg:px-8">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Could not load the shop banner.
      </div>
    </section>
  );
}

function BannerFrame({ banner }: { banner: ShopBannerSettings }) {
  return (
    <section className="mx-auto -mt-[86px] w-full max-w-[1280px] px-5 pb-5 lg:px-8">
      <div className="group relative aspect-[16/7] w-full overflow-hidden rounded-lg bg-bg-soft md:aspect-[16/5] lg:aspect-[16/4]">
        <Image
          src={optimizeCloudinaryImage(
            banner.imageUrl,
            "f_auto,q_auto,c_fill,w_1800",
          )}
          alt="Shop banner"
          fill
          priority
          sizes="(max-width: 768px) 100vw, 1280px"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
        />
      </div>
    </section>
  );
}

export async function ShopBanner() {
  let banner: ShopBannerSettings | null = null;

  try {
    const result = await api.getShopBanner();
    banner = result.item;
  } catch {
    return <ShopBannerError />;
  }

  if (!banner?.imageUrl) return null;

  return <BannerFrame banner={banner} />;
}
