import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { User } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ClientCompany from "@/pages/client/ClientCompany";
import ClientAccount from "@/pages/client/ClientAccount";

export default function ClientProfile() {
  const [searchParams, setSearchParams] = useSearchParams();

  const defaultTab = useMemo(() => {
    const tab = searchParams.get("tab");
    return tab === "account" ? "account" : "company";
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-800 dark:text-white">
          <User className="h-8 w-8 text-primary" />
          Perfil
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Tudo em um só lugar: dados da empresa e da sua conta.
        </p>
      </div>

      <Tabs
        defaultValue={defaultTab}
        onValueChange={(v) => {
          const next = new URLSearchParams(searchParams);
          next.set("tab", v);
          setSearchParams(next, { replace: true });
        }}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="company">Minha Empresa</TabsTrigger>
          <TabsTrigger value="account">Minha Conta</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-6">
          <ClientCompany embedded />
        </TabsContent>

        <TabsContent value="account" className="mt-6">
          <ClientAccount embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
