import { AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface BusinessEconomicsAlertProps {
  className?: string;
}

export function BusinessEconomicsAlert({ className }: BusinessEconomicsAlertProps) {
  const navigate = useNavigate();

  return (
    <div className={`bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-6 ${className}`}>
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="bg-amber-100 dark:bg-amber-900/50 rounded-full p-2">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="font-medium text-amber-900 dark:text-amber-100">
              Precisamos entender seu negócio
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Para calcular seu retorno com precisão, precisamos entender a economia do seu negócio. 
              Leva menos de 1 minuto.
            </p>
          </div>
        </div>
        <Button 
          onClick={() => navigate('/client/company')}
          className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
        >
          Configurar Agora
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
