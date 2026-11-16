import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../src/context/AuthContext";
import { api } from "../../../src/lib/api";
import { asList, pick } from "../../../src/lib/format";
import { Button, Card, Field, Input, T, toast } from "../../../src/components/ui";
import { Page, SelectField } from "../../../src/components/kit";
import { C } from "../../../src/theme";
import { MAX_OPTIONS, MAX_OPTION_NAME, MAX_VARIANTS, parseValues } from "../../../src/components/stock/ProductVariantsSection";

const MAX_NAME = 120;
const MAX_SKU = 64;
const MAX_MONEY = 99999999.99;
const decimal = (value: string) => value.replace(/[^0-9.]/g, "");
const digits = (value: string) => value.replace(/[^0-9]/g, "");

type Step = 0 | 1 | 2;
type OptionDraft = { id: number; name: string; values: string };

const blank = () => ({
  name: "",
  price: "",
  initialStock: "",
  categoryId: "",
  unitId: "",
  sku: "",
  description: "",
  costPrice: "",
  discountPrice: "",
  lowStockThreshold: "",
});

function Progress({ step }: { step: Step }) {
  const labels = ["Product", "Stock & options", "Extra details"];
  return (
    <View style={{ gap: 9 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <T w="bold" size={12} color={C.ink500}>STEP {step + 1} OF 3</T>
        <T w="semi" size={12} color={C.brand}>{labels[step]}</T>
      </View>
      <View style={{ height: 6, borderRadius: 99, backgroundColor: C.cream200, overflow: "hidden" }}>
        <View style={{ height: 6, width: `${((step + 1) / 3) * 100}%`, backgroundColor: C.brand, borderRadius: 99 }} />
      </View>
    </View>
  );
}

function Info({ children }: { children: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 8, padding: 11, borderRadius: 13, backgroundColor: C.brand50 }}>
      <Ionicons name="information-circle-outline" size={17} color={C.brand} />
      <T size={11.5} color={C.ink500} style={{ flex: 1, lineHeight: 17 }}>{children}</T>
    </View>
  );
}

export default function NewProductScreen() {
  const router = useRouter();
  const { me } = useAuth();
  const currency = (me.store as any)?.currency || "NGN";
  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState(blank);
  const [cats, setCats] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [optionsEnabled, setOptionsEnabled] = useState(false);
  const [options, setOptions] = useState<OptionDraft[]>([{ id: 1, name: "Size", values: "" }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const [imagePreviewUri, setImagePreviewUri] = useState("");

  const update = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }));

  const loadCatalog = useCallback(async () => {
    const [c, u] = await Promise.allSettled([
      api.get("/api/dashboard/categories"),
      api.get("/api/dashboard/units"),
    ]);
    if (c.status === "fulfilled") setCats(asList(c.value, "categories", "items", "data"));
    if (u.status === "fulfilled") setUnits(asList(u.value, "units", "items", "data"));
  }, []);
  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  const cleanOptions = useMemo(() => options
    .map((option) => ({ name: option.name.trim(), values: parseValues(option.values) }))
    .filter((option) => option.name || option.values.length), [options]);
  const variantCount = cleanOptions.length ? cleanOptions.reduce((total, option) => total * Math.max(option.values.length, 1), 1) : 0;

  const chooseProductImage = async () => {
    setError("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Allow Brikoh to access your photos so you can choose a product image.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const contentType = asset.mimeType || "image/jpeg";
    if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
      setError("Choose a JPEG, PNG or WebP image.");
      return;
    }

    setImageBusy(true);
    setImagePreviewUri(asset.uri);
    setUploadedImageUrl("");
    try {
    
// 1. Request Cloudinary signing details from Brikoh backend
const response: any = await api.post(
  "/api/dashboard/uploads/presign-product-image",
  {
    fileName:
      asset.fileName ||
      `product-${Date.now()}.${contentType.split("/")[1] || "jpg"}`,
    contentType,
    declaredSizeBytes: asset.fileSize ?? 0,
  }
);

// Handle either a direct response or a wrapped response
const signedData =
  response?.data?.data ??
  response?.data ??
  response;

if (
  !signedData?.cloudName ||
  !signedData?.apiKey ||
  !signedData?.timestamp ||
  !signedData?.signature ||
  !signedData?.folder ||
  !signedData?.publicId
) {
  console.log("Cloudinary signing response:", response);
  throw new Error("The server returned incomplete image upload details.");
}

// 2. Prepare Cloudinary upload
const formData = new FormData();

formData.append("api_key", String(signedData.apiKey));
formData.append("timestamp", String(signedData.timestamp));
formData.append("signature", signedData.signature);
formData.append("folder", signedData.folder);
formData.append("public_id", signedData.publicId);

// Handle browser and native uploads
if (Platform.OS === "web") {
  const fileResponse = await fetch(asset.uri);
  const imageBlob = await fileResponse.blob();

  formData.append("file", imageBlob, asset.fileName || "product.jpg");
} else {
  formData.append("file", {
    uri: asset.uri,
    name: asset.fileName || "product.jpg",
    type: contentType,
  } as any);
}

// 3. Upload directly to Cloudinary
const cloudinaryResponse = await fetch(
  `https://api.cloudinary.com/v1_1/${signedData.cloudName}/image/upload`,
  {
    method: "POST",
    body: formData,
  }
);

const cloudinaryResult = await cloudinaryResponse.json();

if (!cloudinaryResponse.ok) {
  console.error("Cloudinary upload error:", cloudinaryResult);
  throw new Error(
    cloudinaryResult?.error?.message || "Cloudinary image upload failed."
  );
}

// 4. Save uploaded image URL
setUploadedImageUrl(cloudinaryResult.secure_url);

    } catch (e: any) {
      setImagePreviewUri("");
      setUploadedImageUrl("");
      setError(e?.message || "Couldn't upload the product photo. Please try again.");
    } finally {
      setImageBusy(false);
    }
  };

  const removeProductImage = () => {
    setImagePreviewUri("");
    setUploadedImageUrl("");
  };

  const validateStep = () => {
    setError("");
    if (step === 0) {
      const name = form.name.trim();
      if (!name) { setError("Enter the product name to continue."); return false; }
      if (name.length > MAX_NAME) { setError(`Product names must be ${MAX_NAME} characters or fewer.`); return false; }
      const price = Number(form.price);
      if (!form.price.trim() || !Number.isFinite(price) || price <= 0 || price > MAX_MONEY || Math.round(price * 100) !== price * 100) {
        setError("Enter a selling price greater than zero. You can use up to 2 decimal places."); return false;
      }
    }
    if (step === 1) {
      if (optionsEnabled) {
        if (!cleanOptions.length) { setError("Add at least one product option, such as Size or Colour."); return false; }
        if (cleanOptions.length > MAX_OPTIONS) { setError(`You can add up to ${MAX_OPTIONS} option types.`); return false; }
        for (const option of cleanOptions) {
          if (!option.name) { setError("Give each option a name, such as Size or Colour."); return false; }
          if (option.name.length > MAX_OPTION_NAME) { setError(`Option names must be ${MAX_OPTION_NAME} characters or fewer.`); return false; }
          if (!option.values.length) { setError(`Add values for ${option.name}. Separate each value with a comma.`); return false; }
          if (option.values.some((value) => value.length > MAX_OPTION_NAME)) { setError(`Each ${option.name} value must be ${MAX_OPTION_NAME} characters or fewer.`); return false; }
        }
        if (variantCount > MAX_VARIANTS) { setError(`These options create ${variantCount} versions. The limit is ${MAX_VARIANTS}.`); return false; }
      } else if (form.initialStock.trim()) {
        const stock = Number(form.initialStock);
        if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) { setError("Enter a whole-number stock quantity between 0 and 1,000,000."); return false; }
      }
    }
    return true;
  };

  const save = async (addAnother = false) => {
    setError("");
    if (imageBusy) { setError("Wait for the product photo to finish uploading."); return; }
    const name = form.name.trim();
    const price = Number(form.price);
    if (!name || !Number.isFinite(price) || price <= 0) {
      setStep(0);
      setError("Please enter a product name and a valid selling price.");
      return;
    }
    if (form.sku.trim().length > MAX_SKU) { setStep(2); setError(`Product codes must be ${MAX_SKU} characters or fewer.`); return; }
    const costPrice = form.costPrice.trim() ? Number(form.costPrice) : null;
    if (costPrice !== null && (!Number.isFinite(costPrice) || costPrice < 0 || costPrice > MAX_MONEY || Math.round(costPrice * 100) !== costPrice * 100)) {
      setStep(2); setError("Enter a valid cost price."); return;
    }
    const discountPrice = form.discountPrice.trim() ? Number(form.discountPrice) : null;
    if (discountPrice !== null && (!Number.isFinite(discountPrice) || discountPrice < 0 || discountPrice >= price || Math.round(discountPrice * 100) !== discountPrice * 100)) {
      setStep(2); setError("The special selling price must be lower than the regular price."); return;
    }
    const lowStock = form.lowStockThreshold.trim() ? Number(form.lowStockThreshold) : null;
    if (lowStock !== null && (!Number.isInteger(lowStock) || lowStock < 0)) { setStep(2); setError("The low-stock reminder must be a whole number of zero or more."); return; }
    if (optionsEnabled && (!validateOptions())) { setStep(1); return; }

    setBusy(true);
    try {
      let categoryId = form.categoryId;
      let unitId = form.unitId;
      if (categoryId === "__new") {
        if (!newCategory.trim()) throw new Error("Enter the new category name.");
        const response: any = await api.post("/api/dashboard/categories", { name: newCategory.trim() });
        categoryId = pick<string>(response, ["id"]) || response?.category?.id || response?.data?.id || "";
        if (!categoryId) throw new Error("The category could not be created. Please try again.");
      }
      if (unitId === "__new") {
        if (!newUnit.trim()) throw new Error("Enter the new unit name.");
        const response: any = await api.post("/api/dashboard/units", { name: newUnit.trim() });
        unitId = pick<string>(response, ["id"]) || response?.unit?.id || response?.data?.id || "";
        if (!unitId) throw new Error("The unit could not be created. Please try again.");
      }

      const payload: Record<string, unknown> = { name, price };
      if (form.sku.trim()) payload.sku = form.sku.trim();
      if (form.description.trim()) payload.description = form.description.trim();
      if (costPrice !== null) payload.costPrice = costPrice;
      if (discountPrice !== null) payload.discountPrice = discountPrice;
      if (categoryId && categoryId !== "__new") payload.categoryId = categoryId;
      if (unitId && unitId !== "__new") payload.unitId = unitId;
      if (lowStock !== null) payload.lowStockThreshold = lowStock;
      if (imageBusy) throw new Error("Wait for the product photo to finish uploading.");
      if (uploadedImageUrl) {
        payload.images = [uploadedImageUrl];
        payload.coverImageUrl = uploadedImageUrl;
      }
      if (optionsEnabled) payload.options = cleanOptions;
      else if (form.initialStock.trim()) payload.initialStock = Number(form.initialStock);

      const response: any = await api.post("/api/dashboard/products", payload);
      const productId = response?.product?.id ?? response?.id;
      toast.success("Product added to your catalogue.");
      if (addAnother) {
        setForm(blank());
        setStep(0);
        setOptionsEnabled(false);
        setOptions([{ id: Date.now(), name: "Size", values: "" }]);
        setNewCategory("");
        setNewUnit("");
        setUploadedImageUrl("");
        setImagePreviewUri("");
        setError("");
        loadCatalog();
      } else if (productId) {
        router.replace(`/product/${productId}`);
      } else {
        router.back();
      }
    } catch (e: any) {
      setError(e?.code === "PRODUCT_LIMIT_REACHED" ? "You've reached your plan's product limit. Upgrade your plan to add more." : e?.message || "Couldn't add this product. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const validateOptions = () => {
    if (!cleanOptions.length || cleanOptions.length > MAX_OPTIONS) return false;
    for (const option of cleanOptions) if (!option.name || !option.values.length || option.values.some((value) => value.length > MAX_OPTION_NAME)) return false;
    return variantCount <= MAX_VARIANTS;
  };

  const categoryChoices = [
    { value: "", label: "Choose a category (optional)" },
    ...cats.map((category) => ({ value: String(category.id), label: category.name })),
    { value: "__new", label: "+ Create a category" },
  ];
  const unitChoices = [
    { value: "", label: "Choose how you count it (optional)" },
    ...units.map((unit) => ({ value: String(unit.id), label: unit.name })),
    { value: "__new", label: "+ Create a unit" },
  ];

  return (
    <Page title="Add a product">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 36, gap: 16 }} showsVerticalScrollIndicator={false}>
          <Progress step={step} />
          <View style={{ gap: 5 }}>
            <T w="display" size={25}>{step === 0 ? "What are you selling?" : step === 1 ? "How do you keep it?" : "A few more details"}</T>
            <T size={13} color={C.ink400} style={{ lineHeight: 19 }}>
              {step === 0 ? "Start with the basics. You can add the other details later." : step === 1 ? "Tell Brikoh how many you have, or add sizes, colours and other options." : "These details are optional. They help you manage stock and understand your profit."}
            </T>
          </View>

          {error ? <View style={{ backgroundColor: C.danger100, borderRadius: 13, padding: 12 }}><T color={C.danger500} w="bold" size={12}>{error}</T></View> : null}

          {step === 0 ? (
            <>
              <Card style={{ padding: 14, gap: 9 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: C.brand50, alignItems: "center", justifyContent: "center" }}><Ionicons name="cube-outline" size={21} color={C.brand} /></View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T w="bold" size={14}>Product information</T>
                    <T size={11} color={C.ink400}>The name and selling price are all you need to start.</T>
                  </View>
                </View>
                <Field label="What is the product called? *" hint="Use the name customers will recognise.">
                  <Input value={form.name} onChangeText={(value) => update({ name: value })} placeholder="e.g. Coca-Cola 50cl" maxLength={MAX_NAME} returnKeyType="next" />
                </Field>
                <Field label={`How much will you sell it for? (${currency}) *`} hint="This is the price customers will pay.">
                  <Input value={form.price} onChangeText={(value) => update({ price: decimal(value) })} placeholder="e.g. 500" keyboardType="decimal-pad" />
                </Field>
              </Card>
              <Card style={{ padding: 14, gap: 10 }}>
                <T w="bold" size={14}>Where should we organise it?</T>
                <SelectField label="Category" value={form.categoryId} options={categoryChoices} onChange={(value) => update({ categoryId: value })} placeholder="Choose a category (optional)" />
                {form.categoryId === "__new" ? <Field label="New category name"><Input value={newCategory} onChangeText={setNewCategory} placeholder="e.g. Soft drinks" /></Field> : null}
              </Card>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Card style={{ padding: 14, gap: 12 }}>
                <T w="bold" size={15}>How many do you have right now?</T>
                <T size={11.5} color={C.ink400}>Enter the number currently on your shelf or in your store room.</T>
                {!optionsEnabled ? (
                  <Field label="Quantity in stock" hint="You can leave this blank if you want to add stock later.">
                    <Input value={form.initialStock} onChangeText={(value) => update({ initialStock: digits(value) })} placeholder="e.g. 24" keyboardType="number-pad" />
                  </Field>
                ) : (
                  <Info>You'll enter the quantity for each size, colour or version after the product is created. Don't enter one total quantity here.</Info>
                )}
              </Card>
              <Card style={{ padding: 14, gap: 11 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <T w="bold" size={15}>Does it come in different options?</T>
                    <T size={11.5} color={C.ink400}>For example: shirt sizes, shoe sizes or drink flavours.</T>
                  </View>
                  <Pressable onPress={() => { setOptionsEnabled((value) => !value); setError(""); }} style={{ paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12, backgroundColor: optionsEnabled ? C.brand : C.cream100 }}>
                    <T w="bold" size={12} color={optionsEnabled ? "#fff" : C.ink700}>{optionsEnabled ? "Yes" : "No"}</T>
                  </Pressable>
                </View>
                {optionsEnabled ? (
                  <>
                    <Info>Example: add an option called Size, then enter Small, Medium, Large. You can add a second option such as Colour.</Info>
                    {options.map((option, index) => (
                      <View key={option.id} style={{ gap: 7, padding: 11, borderWidth: 1, borderColor: C.cream200, borderRadius: 14 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <T w="bold" size={12}>Option {index + 1}</T>
                          {options.length > 1 ? <Pressable onPress={() => setOptions((list) => list.filter((item) => item.id !== option.id))}><Ionicons name="trash-outline" size={17} color={C.danger500} /></Pressable> : null}
                        </View>
                        <Field label="What is the option called?">
                          <Input value={option.name} onChangeText={(value) => setOptions((list) => list.map((item) => item.id === option.id ? { ...item, name: value } : item))} placeholder="e.g. Size or Colour" />
                        </Field>
                        <Field label="What choices are available?" hint="Separate each choice with a comma.">
                          <Input value={option.values} onChangeText={(value) => setOptions((list) => list.map((item) => item.id === option.id ? { ...item, values: value } : item))} placeholder="e.g. Small, Medium, Large" />
                        </Field>
                      </View>
                    ))}
                    <Button small variant="outline" icon="add" label="Add another option" disabled={options.length >= MAX_OPTIONS} onPress={() => setOptions((list) => [...list, { id: Date.now(), name: "Colour", values: "" }])} />
                    <View style={{ padding: 12, borderRadius: 13, backgroundColor: C.brand50, gap: 3 }}>
                      <T w="bold" color={C.brand} size={13}>{variantCount || 0} product versions</T>
                      <T size={11} color={C.ink500}>Brikoh will create these combinations for you. You can set each version's stock after saving.</T>
                    </View>
                  </>
                ) : null}
              </Card>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Card style={{ padding: 14, gap: 12 }}>
                <T w="bold" size={15}>Help customers understand the product</T>
                <Field label="Product description" hint="Optional. A short description customers can read.">
                  <Input value={form.description} onChangeText={(value) => update({ description: value })} placeholder="Describe the product..." multiline style={{ height: 100, alignItems: "flex-start", paddingTop: 12 }} />
                </Field>
                <View style={{ gap: 9 }}>
                  <T w="semi" size={12}>Product photo</T>
                  <T size={11.5} color={C.ink400}>Choose a photo directly from your phone. JPEG, PNG and WebP are supported.</T>
                  {imagePreviewUri ? (
                    <View style={{ gap: 8 }}>
                      <Image source={{ uri: imagePreviewUri }} contentFit="cover" style={{ width: 132, height: 132, borderRadius: 16, backgroundColor: C.cream100 }} />
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Button small variant="outline" label="Change photo" icon="image" disabled={imageBusy} onPress={chooseProductImage} />
                        <Button small variant="ghost" label="Remove" icon="trash-outline" disabled={imageBusy} onPress={removeProductImage} />
                      </View>
                      {imageBusy ? <T size={11} color={C.brand}>Uploading photo…</T> : uploadedImageUrl ? <T size={11} color={C.leaf500}>Photo uploaded</T> : null}
                    </View>
                  ) : (
                    <Pressable onPress={chooseProductImage} disabled={imageBusy} style={{ minHeight: 116, borderWidth: 1.5, borderStyle: "dashed", borderColor: C.cream300, borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: C.cream50, opacity: imageBusy ? 0.6 : 1 }}>
                      <Ionicons name="cloud-upload-outline" size={26} color={C.brand} />
                      <T w="bold" size={12} color={C.brand}>{imageBusy ? "Uploading photo…" : "Choose photo from device"}</T>
                      <T size={10.5} color={C.ink400}>Tap to open your gallery</T>
                    </Pressable>
                  )}
                </View>
              </Card>
              <Card style={{ padding: 14, gap: 12 }}>
                <T w="bold" size={15}>Manage your costs and stock</T>
                <Field label={`How much does it cost you? (${currency})`} hint="Optional. Brikoh uses this to help calculate your profit.">
                  <Input value={form.costPrice} onChangeText={(value) => update({ costPrice: decimal(value) })} placeholder="e.g. 350" keyboardType="decimal-pad" />
                </Field>
                <Field label={`Special selling price (${currency})`} hint="Optional. This must be lower than the regular selling price.">
                  <Input value={form.discountPrice} onChangeText={(value) => update({ discountPrice: decimal(value) })} placeholder="Leave blank if there is no discount" keyboardType="decimal-pad" />
                </Field>
                <Field label="Remind me when stock gets low" hint="Brikoh will flag the product when stock reaches this number.">
                  <Input value={form.lowStockThreshold} onChangeText={(value) => update({ lowStockThreshold: digits(value) })} placeholder="e.g. 5" keyboardType="number-pad" />
                </Field>
                <Field label="How do you count this product?">
                  <SelectField value={form.unitId} options={unitChoices} onChange={(value) => update({ unitId: value })} placeholder="Choose a unit (optional)" />
                </Field>
                {form.unitId === "__new" ? <Field label="New unit name"><Input value={newUnit} onChangeText={setNewUnit} placeholder="e.g. Bottle, Piece, Carton" /></Field> : null}
                <Field label="Product code (SKU)" hint="Optional. You can leave this blank if you don't use product codes.">
                  <Input value={form.sku} onChangeText={(value) => update({ sku: value.toUpperCase() })} placeholder="e.g. COKE-50" maxLength={MAX_SKU} autoCapitalize="characters" />
                </Field>
              </Card>
            </>
          ) : null}

          {step > 0 ? <Button label="Back" variant="outline" icon="chevron-back" onPress={() => { setError(""); setStep((step - 1) as Step); }} /> : null}
          {step < 2 ? <Button label="Continue" icon="arrow-forward" onPress={() => { if (validateStep()) setStep((step + 1) as Step); }} /> : (
            <>
              <Button label="Save product" busy={busy || imageBusy} disabled={imageBusy} onPress={() => save(false)} />
              <Button label="Save and add another" variant="outline" busy={busy || imageBusy} disabled={imageBusy} onPress={() => save(true)} />
              <T size={10.5} color={C.ink400} style={{ textAlign: "center", lineHeight: 16 }}>Your product is saved to your catalogue as a draft. To make it available to customers, complete any publishing requirements shown on its product page.</T>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Page>
  );
}
