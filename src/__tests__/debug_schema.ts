import { aiRecommendationsSchema } from "../lib/validation";

const testData = {
  query: "piel",
  clientId: "3f2a4b6c-8d1e-4f5a-9b7c-1d2e3f4a5b6c",
  productIds: ["9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d"]
};

const r = aiRecommendationsSchema.safeParse(testData);
console.log("success:", r.success);
if (!r.success) {
  console.log("errors:", JSON.stringify(r.error.issues, null, 2));
} else {
  console.log("data:", r.data);
}