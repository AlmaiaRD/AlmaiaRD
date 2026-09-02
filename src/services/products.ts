import { supabase } from "@/lib/supabase";
import { normalize } from "@/lib/search";
import { getCached, setCache, invalidateCache } from "@/lib/cache";
import type { Product, Category, Subbrand, BundleItem } from "@/types/database";

export async function getProducts(includeInactive = false) {
  let query = supabase
    .from("products")
    .select("*, categories(*), subbrands(*)");
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query.order("name");
  if (error) throw error;
  return data;
}

export async function getProductsPaginated(page: number, pageSize = 50, includeInactive = false) {
  let query = supabase
    .from("products")
    .select("*, categories(*), subbrands(*)", { count: "exact" });
  if (!includeInactive) query = query.eq("active", true);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await query.order("name").range(from, to);
  if (error) throw error;
  return { data, total: count || 0, page, pageSize };
}

export async function getProduct(id: string) {
  const { data, error } = await supabase
    .from("products")
    .select("*, categories(*), subbrands(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createProduct(product: Partial<Product>) {
  const { data, error } = await supabase.from("products").insert(product).select().single();
  if (error) throw error;
  return data as Product;
}

export async function updateProduct(id: string, product: Partial<Product>) {
  const { data, error } = await supabase.from("products").update(product).eq("id", id).select().single();
  if (error) throw error;
  return data as Product;
}

export async function deactivateProduct(id: string) {
  const { error } = await supabase.from("products").update({ active: false }).eq("id", id);
  if (error) throw error;
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
  invalidateCache("products");
}

export async function getBundleItems(bundleId: string): Promise<BundleItem[]> {
  const { data, error } = await supabase
    .from("bundle_items")
    .select("*, products!bundle_items_product_id_fkey(*, categories(*), subbrands(*))")
    .eq("bundle_id", bundleId)
    .order("created_at");
  if (error) throw error;
  return (data || []) as BundleItem[];
}

export async function getBundleItemsBatch(bundleIds: string[]): Promise<BundleItem[]> {
  const ids = bundleIds.filter(Boolean);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("bundle_items")
    .select("*, products!bundle_items_product_id_fkey(*, categories(*), subbrands(*))")
    .in("bundle_id", ids);
  if (error) throw error;
  return (data || []) as BundleItem[];
}

export interface BundleComponentInfo {
  product_id: string;
  quantity: number;
  name?: string | null;
}

export async function getBundleComponentMap(bundleIds: string[]): Promise<Map<string, BundleComponentInfo[]>> {
  const ids = bundleIds.filter(Boolean);
  const map = new Map<string, BundleComponentInfo[]>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase
    .from("bundle_items")
    .select("bundle_id, product_id, quantity, products!bundle_items_product_id_fkey(name)")
    .in("bundle_id", ids);
  if (error) throw error;
  for (const row of data || []) {
    const bundleId = row.bundle_id;
    const arr = map.get(bundleId) || [];
    arr.push({ product_id: row.product_id, quantity: Number(row.quantity || 1), name: (row as any).products?.name });
    map.set(bundleId, arr);
  }
  return map;
}

export async function removeProductImage(url: string | null | undefined) {
  if (!url) return;
  const marker = "/object/public/product-images/";
  const idx = url.indexOf(marker);
  if (idx === -1) return;
  const path = url.slice(idx + marker.length).split("?")[0];
  if (!path) return;
  try {
    await supabase.storage.from("product-images").remove([path]);
  } catch {
    // No debe bloquear la eliminación del producto
  }
}

export interface BundleComponent {
  product_id: string;
  quantity: number;
}

export async function createBundle(
  product: Partial<Product>,
  components: BundleComponent[]
): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .insert({ ...product, is_bundle: true })
    .select()
    .single();
  if (error) throw error;
  const bundleId = (data as Product).id;
  if (components.length > 0) {
    const { error: itemsError } = await supabase.from("bundle_items").insert(
      components.map((c) => ({ bundle_id: bundleId, ...c }))
    );
    if (itemsError) throw itemsError;
  }
  invalidateCache("products");
  return data as Product;
}

export async function updateBundle(
  bundleId: string,
  product: Partial<Product>,
  components: BundleComponent[]
): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .update({ ...product, is_bundle: true })
    .eq("id", bundleId)
    .select()
    .single();
  if (error) throw error;
  const { error: delError } = await supabase
    .from("bundle_items")
    .delete()
    .eq("bundle_id", bundleId);
  if (delError) throw delError;
  if (components.length > 0) {
    const { error: itemsError } = await supabase.from("bundle_items").insert(
      components.map((c) => ({ bundle_id: bundleId, ...c }))
    );
    if (itemsError) throw itemsError;
  }
  invalidateCache("products");
  return data as Product;
}

export async function searchProducts(query: string) {
  const all = await getProducts();
  const q = normalize(query);
  return all.filter(
    (p: unknown) => {
      const pp = p as Record<string, unknown>;
      return normalize(pp.name as string).includes(q) ||
        (pp.code && normalize(pp.code as string).includes(q));
    }
  );
}

export async function getCategories(useCache = true) {
  const cached = useCache ? await getCached<Category[]>("categories") : undefined;
  if (cached) return cached;
  const { data, error } = await supabase.from("categories").select("*").eq("active", true).order("name");
  if (error) throw error;
  const result = data as Category[];
  await setCache("categories", result, 300_000);
  return result;
}

export async function getSubbrands(useCache = true) {
  const cached = useCache ? await getCached<Subbrand[]>("subbrands") : undefined;
  if (cached) return cached;
  const { data, error } = await supabase.from("subbrands").select("*").eq("active", true).order("name");
  if (error) throw error;
  const result = data as Subbrand[];
  await setCache("subbrands", result, 300_000);
  return result;
}

export async function createCategory(name: string) {
  const { data, error } = await supabase.from("categories").insert({ name }).select().single();
  if (error) throw error;
  invalidateCache("categories");
  return data as Category;
}

export async function createSubbrand(name: string) {
  const { data, error } = await supabase.from("subbrands").insert({ name }).select().single();
  if (error) throw error;
  invalidateCache("subbrands");
  return data as Subbrand;
}

export async function deactivateSubbrand(id: string) {
  const { error } = await supabase.from("subbrands").update({ active: false }).eq("id", id);
  if (error) throw error;
  invalidateCache("subbrands");
}

export async function deactivateCategory(id: string) {
  const { error } = await supabase.from("categories").update({ active: false }).eq("id", id);
  if (error) throw error;
  invalidateCache("categories");
}

