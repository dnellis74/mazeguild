import { getCatalog } from "@/training/catalog";

export async function GET() {
  try {
    const catalog = getCatalog();
    return Response.json({
      races: catalog.races.map((r) => ({ id: r.id, name: r.name })),
      alignments: catalog.alignments.map((a) => ({ id: a.id, name: a.name })),
      timing: catalog.timing,
      cantripKnown: catalog.cantripKnown,
      spellKnown: catalog.spellKnown,
      skillCount: catalog.skills.length,
    });
  } catch (err) {
    console.error(JSON.stringify({ msg: "training_catalog_error", err: String(err) }));
    return Response.json({ error: "Failed to load catalog" }, { status: 500 });
  }
}
