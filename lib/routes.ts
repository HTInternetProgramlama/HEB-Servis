export const pagesBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function detailHref(path: string, id: string) {
  return path + '/?id=' + encodeURIComponent(id);
}
