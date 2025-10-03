"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Always use latest available model
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

/**
 * Generate industry insights from Gemini AI
 * Returns parsed JSON object, or a fallback if generation fails.
 */
export const generateAIInsights = async (industry) => {
  const prompt = `
    Analyze the current state of the ${industry} industry and provide insights in ONLY the following JSON format:
    {
      "salaryRanges": [
        { "role": "string", "min": number, "max": number, "median": number, "location": "string" }
      ],
      "growthRate": number,
      "demandLevel": "HIGH" | "MEDIUM" | "LOW",
      "topSkills": ["skill1", "skill2"],
      "marketOutlook": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
      "keyTrends": ["trend1", "trend2"],
      "recommendedSkills": ["skill1", "skill2"]
    }

    Rules:
    - Return ONLY the JSON. No markdown, no explanations.
    - Include at least 5 roles in salaryRanges.
    - Growth rate must be a percentage number.
    - Include at least 5 skills and 5 trends.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

    // Try to parse JSON safely
    return JSON.parse(cleanedText);
  } catch (err) {
    console.error("Gemini AI error while generating insights:", err);

    // Fallback insights so the app doesn’t crash
    return {
      salaryRanges: [],
      growthRate: 0,
      demandLevel: "LOW",
      topSkills: [],
      marketOutlook: "NEUTRAL",
      keyTrends: [],
      recommendedSkills: [],
    };
  }
};

/**
 * Fetch or create industry insights for the logged-in user
 */
export async function getIndustryInsights() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
    include: { industryInsight: true },
  });

  if (!user) throw new Error("User not found");

  // If user has no industry set, prevent crash
  if (!user.industry) {
    console.warn("User has no industry defined:", user.clerkUserId);
    return null;
  }

  // If insights exist, return them
  if (user.industryInsight) {
    return user.industryInsight;
  }

  // Otherwise, generate new insights
  const insights = await generateAIInsights(user.industry);

  try {
    const industryInsight = await db.industryInsight.create({
      data: {
        industry: user.industry,
        ...insights,
        nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days later
      },
    });

    return industryInsight;
  } catch (err) {
    console.error("Database error while creating industryInsight:", err);
    return null;
  }
}
