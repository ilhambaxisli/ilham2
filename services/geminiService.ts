
import { GoogleGenAI, Type } from "@google/genai";
import { DiscountProduct } from "../types";

let aiClient: GoogleGenAI | null = null;
const getAi = () => {
  if (!aiClient) {
    const key = (typeof process !== 'undefined' && process.env && (process.env.API_KEY || process.env.GEMINI_API_KEY)) || '';
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
};

const extractProductsFromStream = (text: string): DiscountProduct[] => {
  if (!text || text.trim().length === 0) return [];

  try {
    const cleanFull = text.trim().replace(/^```json/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleanFull);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === 'object' && parsed !== null && (parsed as any).products) return (parsed as any).products;
  } catch (e) {}

  try {
    let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const arrayStartIndex = cleanText.indexOf('[');
    if (arrayStartIndex === -1) {
      const productsKeyIndex = cleanText.indexOf('"products"');
      if (productsKeyIndex !== -1) {
        const startOfArrayAfterKey = cleanText.indexOf('[', productsKeyIndex);
        if (startOfArrayAfterKey !== -1) cleanText = cleanText.substring(startOfArrayAfterKey);
      } else return [];
    } else cleanText = cleanText.substring(arrayStartIndex);

    const lastObjectEnd = cleanText.lastIndexOf('}');
    if (lastObjectEnd === -1) return [];
    const validJsonString = cleanText.substring(0, lastObjectEnd + 1) + ']';
    const parsed = JSON.parse(validJsonString);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

export const analyzeCatalogStream = async (
  base64Data: string,
  mimeType: string,
  marketName: string,
  onProgress: (products: DiscountProduct[]) => void
): Promise<void> => {
  try {
    const prompt = `
      Sən peşəkar bir məlumat analitikisən. Sənə təqdim olunan bu kataloq SƏHİFƏSİNDƏKİ bütun endirimli məhsulları dəqiqliklə siyahıya al.
      
      MARKET: ${marketName}

      VƏZİFƏ:
      Görüntüdəki hər bir məhsulu diqqətlə araşdır. Qiymətləri (köhnə və yeni), endirim faizini və əgər qeyd olunubsa "Son İstifadə Tarixi"ni (expiryDate) oxu.
      
      ÇIXIŞ FORMATI (Xalis JSON Array):
      [
        { 
          "productName": "Məhsulun tam adı", 
          "oldPrice": "0.00", 
          "newPrice": "0.00", 
          "discountPercentage": "0%", 
          "category": "Kateqoriya",
          "expiryDate": "YYYY-MM-DD"
        }
      ]

      QAYDALAR:
      1. Kateqoriyalar: 'Meyvə & Tərəvəz', 'Ət & Toyuq', 'Süd & Səhər Yeməyi', 'Qida & Paxlalılar', 'İçkilər', 'Qəlyanaltı', 'Təmizlik', 'Şəxsi Baxım', 'Ev & Həyat', 'Uşaq', 'Digər'.
      2. Qiymətlərdə valyuta işarəsini yazma, yalnız rəqəmləri yaz.
      3. YALNIZ bu səhifədə olan real endirimli məhsulları yaz.
    `;

    const ai = getAi();
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: "application/json", 
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              productName: { type: Type.STRING },
              oldPrice: { type: Type.STRING },
              newPrice: { type: Type.STRING },
              discountPercentage: { type: Type.STRING },
              category: { 
                type: Type.STRING, 
                enum: [
                  'Meyvə & Tərəvəz', 'Ət & Toyuq', 'Süd & Səhər Yeməyi', 'Qida & Paxlalılar',
                  'İçkilər', 'Qəlyanaltı', 'Təmizlik', 'Şəxsi Baxım', 'Ev & Həyat', 'Uşaq', 'Digər'
                ]
              },
              expiryDate: { type: Type.STRING }
            },
            required: ["productName", "newPrice", "category"]
          },
        },
      },
    });

    let accumulatedText = "";
    let lastProductCount = 0;

    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (text) {
        accumulatedText += text;
        const currentProducts = extractProductsFromStream(accumulatedText);
        if (currentProducts.length > lastProductCount) {
          onProgress(currentProducts);
          lastProductCount = currentProducts.length;
        }
      }
    }

    const finalProducts = extractProductsFromStream(accumulatedText);
    if (finalProducts.length > 0) onProgress(finalProducts);

  } catch (error) {
    console.error("Gemini stream xətası:", error);
    throw error;
  }
};
