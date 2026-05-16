const CLOUDINARY_UPLOAD_SEGMENT = "/image/upload/";

export function optimizeCloudinaryImage(
  src: string,
  transformations = "f_auto,q_auto",
): string {
  if (!src.includes("res.cloudinary.com") || !src.includes(CLOUDINARY_UPLOAD_SEGMENT)) {
    return src;
  }

  const [base, rest] = src.split(CLOUDINARY_UPLOAD_SEGMENT);
  if (!base || !rest || rest.startsWith(transformations)) {
    return src;
  }

  return `${base}${CLOUDINARY_UPLOAD_SEGMENT}${transformations}/${rest}`;
}
