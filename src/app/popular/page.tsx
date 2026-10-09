import { redirect } from "next/navigation";

export default function OldRoute() {
  redirect("/tiers?pool=everyone");
}
