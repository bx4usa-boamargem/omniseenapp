import { useParams } from "react-router-dom";
import { LandingPageEditor } from "@/components/client/landingpage/LandingPageEditor";

export default function ClientLandingPageEditor() {
  const { id } = useParams();

  if (!id || id === "new") {
    return <LandingPageEditor />;
  }

  return <LandingPageEditor pageId={id} />;
}
