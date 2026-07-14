import { supabase } from "@/lib/supabase";
import { normalize } from "@/lib/search";
import { getCached, setCache, invalidateCache } from "@/lib/cache";
import type { Product, Category, Subbrand } from "@/types/database";

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

export async function searchProducts(query: string) {
  const all = await getProducts();
  const q = normalize(query);
  return all.filter(
    (p: any) =>
      normalize(p.name).includes(q) ||
      (p.code && normalize(p.code).includes(q))
  );
}

export async function getCategories(useCache = true) {
  const cached = useCache ? getCached<Category[]>("categories") : undefined;
  if (cached) return cached;
  const { data, error } = await supabase.from("categories").select("*").eq("active", true).order("name");
  if (error) throw error;
  const result = data as Category[];
  setCache("categories", result, 300_000);
  return result;
}

export async function getSubbrands(useCache = true) {
  const cached = useCache ? getCached<Subbrand[]>("subbrands") : undefined;
  if (cached) return cached;
  const { data, error } = await supabase.from("subbrands").select("*").eq("active", true).order("name");
  if (error) throw error;
  const result = data as Subbrand[];
  setCache("subbrands", result, 300_000);
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

export async function importProductsFromPdf(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const { data, error } = await supabase.functions.invoke("import-pdf-catalog", {
    body: formData,
  });
  if (error) throw error;
  return data;
}
