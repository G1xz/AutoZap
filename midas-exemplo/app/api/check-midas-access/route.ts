import { NextRequest, NextResponse } from "next/server";
import { canUserUseMidas, getUserPlan } from "@/app/_lib/plan-limits";

export async function GET(request: NextRequest) {
  try {
    const hasAccess = await canUserUseMidas();
    const plan = await getUserPlan();
    
    return NextResponse.json({
      hasAccess,
      plan,
    });
  } catch (error) {
    console.error("Erro ao verificar acesso ao Midas:", error);
    return NextResponse.json(
      { hasAccess: false, plan: "noPlan", error: "Erro interno" },
      { status: 500 }
    );
  }
}

