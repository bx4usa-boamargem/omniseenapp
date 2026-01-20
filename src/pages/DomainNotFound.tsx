import React from 'react';
import { Globe, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DomainNotFoundProps {
  domain?: string | null;
}

const DomainNotFound: React.FC<DomainNotFoundProps> = ({ domain }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="text-center max-w-md">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <Globe className="w-8 h-8 text-primary" />
        </div>
        
        <h1 className="text-2xl font-bold text-foreground mb-3">
          Domínio não encontrado
        </h1>
        
        <p className="text-muted-foreground mb-2">
          O domínio <span className="font-mono text-primary">{domain || 'desconhecido'}</span> não está configurado na plataforma.
        </p>
        
        <p className="text-sm text-muted-foreground/70 mb-8">
          Se você é o proprietário deste domínio, configure-o no painel da sua subconta.
        </p>
        
        <Button 
          onClick={() => window.location.href = 'https://app.omniseen.app/auth'}
          className="bg-primary hover:bg-primary/90"
        >
          Acessar Plataforma
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default DomainNotFound;
