import { redirect } from "next/navigation";

// How it works is a popup now (the ? in the nav). Old /about links land on the app.
export default function AboutPage() {
  redirect("/");
}
