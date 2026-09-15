import { CharacterInitClient } from "@/components/character/CharacterInitClient";
import { getCharacterInitData } from "@/training/characterInitData";

export default function CharacterPage() {
  const init = getCharacterInitData();
  return <CharacterInitClient init={init} />;
}
