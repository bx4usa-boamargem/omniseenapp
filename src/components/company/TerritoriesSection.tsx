import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTerritories, Territory } from '@/hooks/useTerritories';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { 
  MapPin, 
  Plus, 
  Loader2, 
  Globe2, 
  Trash2, 
  Crown,
  Building2,
  Map
} from 'lucide-react';
import { AddTerritoryModal } from './AddTerritoryModal';

interface TerritoriesSectionProps {
  blogId: string;
}

export function TerritoriesSection({ blogId }: TerritoriesSectionProps) {
  const navigate = useNavigate();
  const { 
    territories, 
    loading, 
    limit, 
    used, 
    canAdd, 
    isUnlimited, 
    plan,
    addTerritory, 
    removeTerritory, 
    toggleActive 
  } = useTerritories(blogId);
  
  const [showAddModal, setShowAddModal] = useState(false);

  const getLocationLabel = (territory: Territory): string => {
    if (territory.city && territory.state) {
      return `${territory.city}, ${territory.state}`;
    }
    if (territory.state) {
      return `${territory.state}, ${territory.country}`;
    }
    return territory.country;
  };

  const getScopeIcon = (territory: Territory) => {
    if (territory.city) return <Building2 className="h-4 w-4" />;
    if (territory.state) return <Map className="h-4 w-4" />;
    return <Globe2 className="h-4 w-4" />;
  };

  const getScopeBadge = (territory: Territory): string => {
    if (territory.city) return 'Cidade';
    if (territory.state) return 'Estado';
    return 'País';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const usagePercent = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Territórios
              </CardTitle>
              <CardDescription className="mt-1">
                Defina as regiões que você quer dominar organicamente
              </CardDescription>
            </div>
            
            {/* Usage Badge */}
            <div className="text-right">
              {isUnlimited ? (
                <Badge variant="secondary" className="gap-1">
                  <Crown className="h-3 w-3" />
                  Ilimitado
                </Badge>
              ) : (
                <Badge variant={used >= limit ? 'destructive' : 'secondary'}>
                  {used} / {limit} territórios
                </Badge>
              )}
            </div>
          </div>

          {/* Progress bar for limited plans */}
          {!isUnlimited && (
            <div className="mt-4 space-y-1">
              <Progress value={usagePercent} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Usando {used} de {limit} territórios do plano {plan?.toUpperCase()}
              </p>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Territory List */}
          {territories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Globe2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum território definido</p>
              <p className="text-sm">Adicione territórios para o Radar analisar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {territories.map((territory) => (
                <div
                  key={territory.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    territory.is_active 
                      ? 'bg-primary/5 border-primary/20' 
                      : 'bg-muted/50 border-border opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      territory.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {getScopeIcon(territory)}
                    </div>
                    <div>
                      <p className="font-medium">{getLocationLabel(territory)}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs">
                          {getScopeBadge(territory)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {territory.country}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Active Toggle */}
                    <Switch
                      checked={territory.is_active}
                      onCheckedChange={(checked) => toggleActive(territory.id, checked)}
                    />

                    {/* Delete Button */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover território?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O território "{getLocationLabel(territory)}" será removido. 
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => removeTerritory(territory.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Territory Button or Upgrade CTA */}
          {canAdd ? (
            <Button 
              onClick={() => setShowAddModal(true)}
              className="w-full gap-2"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
              Adicionar Território
            </Button>
          ) : (
            <div className="p-4 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
              <div className="flex items-start gap-3">
                <Crown className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Limite de territórios atingido</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Seu plano permite {limit} território(s). Faça upgrade para expandir sua presença.
                  </p>
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="mt-3"
                    onClick={() => navigate('/pricing')}
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Ver Planos
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Info Card */}
          <div className="p-3 rounded-lg bg-muted/50 border border-dashed border-border">
            <p className="text-sm text-muted-foreground">
              <strong>💡 Como funciona:</strong> O Radar de Oportunidades analisa cada território 
              ativo semanalmente, identificando temas relevantes e tendências locais para gerar 
              artigos personalizados.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Add Territory Modal */}
      <AddTerritoryModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onAdd={addTerritory}
      />
    </>
  );
}
