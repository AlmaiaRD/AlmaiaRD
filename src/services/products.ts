import { supabase } from "@/lib/supabase";
import type { Product, Category, Subbrand } from "@/types/database";

export async function getProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*, categories(*), subbrands(*)")
    .order("name");
  if (error) throw error;
  return data;
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
  const { data, error } = await supabase
    .from("products")
    .select("*, categories(*), subbrands(*)")
    .or(`name.ilike.%${query}%,code.ilike.%${query}%`)
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return data;
}

export async function getCategories() {
  const { data, error } = await supabase.from("categories").select("*").eq("active", true).order("name");
  if (error) throw error;
  return data as Category[];
}

export async function getSubbrands() {
  const { data, error } = await supabase.from("subbrands").select("*").eq("active", true).order("name");
  if (error) throw error;
  return data as Subbrand[];
}

export async function createCategory(name: string) {
  const { data, error } = await supabase.from("categories").insert({ name }).select().single();
  if (error) throw error;
  return data as Category;
}

export async function createSubbrand(name: string) {
  const { data, error } = await supabase.from("subbrands").insert({ name }).select().single();
  if (error) throw error;
  return data as Subbrand;
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
