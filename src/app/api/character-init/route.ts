import { getCharacterInitData } from "@/training/characterInitData";

export async function GET() {
  try {
    return Response.json(getCharacterInitData());
  } catch (err) {
    console.error(
      JSON.stringify({ msg: "character_init_error", err: String(err) }),
    );
    return Response.json(
      { error: "Failed to load character init data" },
      { status: 500 },
    );
  }
}
