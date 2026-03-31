import { useSearchParams } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileTab } from '@/components/settings/ProfileTab';
import { IntegrationsTab } from '@/components/settings/IntegrationsTab';
import { BillingTab } from '@/components/settings/BillingTab';
import { UsageTab } from '@/components/settings/UsageTab';
import { NotificationsTab } from '@/components/settings/NotificationsTab';
import { ApiKeysTab } from '@/components/settings/ApiKeysTab';
import { WebhooksTab } from '@/components/settings/WebhooksTab';
import { WhiteLabelTab } from '@/components/settings/WhiteLabelTab';

const TABS = [
  { id: 'profile', label: 'Perfil' },
  { id: 'integrations', label: 'Integrações' },
  { id: 'billing', label: 'Cobrança' },
  { id: 'usage', label: 'Uso' },
  { id: 'notifications', label: 'Notificações' },
  { id: 'api-keys', label: 'Chaves de API' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'white-label', label: 'White Label' },
];

export default function ClientSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'profile';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10">
          <Settings className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">
            Gerencie sua conta, integrações e preferências.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="w-full justify-start h-auto p-1 bg-muted/50 rounded-xl flex-wrap">
          {TABS.map((tab) => (
            <TabsTrigger 
              key={tab.id} 
              value={tab.id}
              className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm px-4 py-2"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileTab />
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <IntegrationsTab />
        </TabsContent>

        <TabsContent value="billing" className="mt-6">
          <BillingTab />
        </TabsContent>

        <TabsContent value="usage" className="mt-6">
          <UsageTab />
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <NotificationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
