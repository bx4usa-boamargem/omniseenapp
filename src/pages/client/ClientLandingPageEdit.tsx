import { useParams } from "react-router-dom";
import { LandingPageEditor } from "@/components/client/landingpage/LandingPageEditor";

export default function ClientLandingPageEdit() {
  const { id } = useParams<{ id: string }>();
  
  return <LandingPageEditor pageId={id} />;
}
