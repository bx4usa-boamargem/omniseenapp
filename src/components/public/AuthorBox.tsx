import { Linkedin, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AuthorBoxProps {
  name?: string | null;
  bio?: string | null;
  photoUrl?: string | null;
  linkedinUrl?: string | null;
  /** When true, the author box is completely hidden (privacy opt-out) */
  hideAuthor?: boolean | null;
}

export const AuthorBox = ({ name, bio, photoUrl, linkedinUrl, hideAuthor }: AuthorBoxProps) => {
  // Privacy opt-out: respect the author's choice
  if (hideAuthor) return null;
  // Also hide if no author name set
  if (!name) return null;

  return (
    <div className="bg-muted/30 border border-border/50 rounded-xl p-6">
      <div className="flex items-start gap-4">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={name}
            className="w-16 h-16 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="h-8 w-8 text-primary" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-medium">
            Escrito por
          </p>
          <h3 className="font-heading font-semibold text-foreground text-lg leading-tight">
            {name}
          </h3>
          {bio && (
            <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
              {bio}
            </p>
          )}
          {linkedinUrl && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              asChild
            >
              <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">
                <Linkedin className="h-4 w-4 mr-2" />
                LinkedIn
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
