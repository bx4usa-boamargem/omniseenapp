import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Email template types
type EmailTemplate = 
  | 'welcome'
  | 'email_confirmation'
  | 'password_reset'
  | 'team_invite'
  | 'article_published'
  | 'weekly_report'
  | 'opportunity_alert'
  | 'funnel_report'
  | 'gsc_alert'
  | 'payment_reminder'
  | 'subscription_canceled'
  | 'trial_expiring_3days'
  | 'trial_expiring_1day'
  | 'trial_expired';

type Language = 'pt-BR' | 'en' | 'es';

interface SendEmailRequest {
  to: string;
  toName?: string;
  template: EmailTemplate;
  language?: Language;
  subject?: string;
  variables: Record<string, string>;
  blogId?: string;
  userId?: string;
  htmlContent?: string;
}

// Localized content
const locales: Record<Language, Record<string, string>> = {
  'pt-BR': {
    // Common
    greeting: 'Olá',
    regards: 'Atenciosamente',
    team: 'Equipe Omniseen',
    footer: 'Este email foi enviado automaticamente pela Omniseen.',
    unsubscribe: 'Para não receber mais emails, acesse as configurações da sua conta.',
    
    // Welcome
    welcome_subject: 'Bem-vindo à Omniseen! 🎉',
    welcome_title: 'Bem-vindo à Omniseen!',
    welcome_body: 'Sua conta foi criada com sucesso. Estamos empolgados em tê-lo conosco!',
    welcome_cta: 'Acessar Plataforma',
    
    // Team Invite
    team_invite_subject: 'Você foi convidado para fazer parte do blog {blogName}',
    team_invite_title: 'Convite de Equipe',
    team_invite_body: '{inviterName} convidou você para fazer parte do blog "{blogName}" como {role}.',
    team_invite_cta: 'Aceitar Convite',
    team_invite_expire: 'Este convite expira em 7 dias.',
    
    // Password Reset
    password_reset_subject: 'Redefinição de Senha - Omniseen',
    password_reset_title: 'Redefinir Senha',
    password_reset_body: 'Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha.',
    password_reset_cta: 'Redefinir Senha',
    password_reset_ignore: 'Se você não solicitou esta alteração, ignore este email.',
    
    // Article Published
    article_published_subject: 'Novo artigo publicado: {title}',
    article_published_title: 'Artigo Publicado!',
    article_published_body: 'O artigo "{title}" foi publicado com sucesso no blog "{blogName}".',
    article_published_cta: 'Ver Artigo',
    
    // Weekly Report
    weekly_report_subject: 'Relatório Semanal do Blog - {blogName}',
    weekly_report_title: 'Relatório Semanal',
    
    // Opportunity Alert
    opportunity_alert_subject: '🎯 Nova oportunidade de artigo com {score}% de relevância',
    opportunity_alert_title: 'Nova Oportunidade de Artigo',
    opportunity_alert_body: 'Identificamos uma oportunidade com {score}% de relevância:',
    opportunity_alert_cta: 'Ver Oportunidade',
    
    // GSC Alert
    gsc_alert_subject: '⚠️ Alerta de Ranking - {blogName}',
    gsc_alert_title: 'Alerta do Google Search Console',
    
    // Payment
    payment_reminder_subject: 'Lembrete de Pagamento - Omniseen',
    payment_reminder_title: 'Pagamento Pendente',
    
    // Subscription
    subscription_canceled_subject: 'Sua assinatura foi cancelada',
    subscription_canceled_title: 'Assinatura Cancelada',
    
    // Trial Expiring - 3 days
    trial_expiring_3days_subject: '⏰ Seu teste grátis termina em 3 dias',
    trial_expiring_3days_title: 'Faltam 3 dias para o fim do seu teste',
    trial_expiring_3days_body: 'Seu período de teste gratuito na Omniseen termina em 3 dias. Para não perder acesso às suas criações e continuar gerando artigos incríveis, ative sua assinatura agora.',
    trial_expiring_3days_cta: 'Ativar Assinatura',
    trial_expiring_3days_benefit1: '✅ Mantenha acesso a todos os seus artigos',
    trial_expiring_3days_benefit2: '✅ Continue gerando conteúdo com IA',
    trial_expiring_3days_benefit3: '✅ Sem interrupções no seu workflow',
    
    // Trial Expiring - 1 day
    trial_expiring_1day_subject: '🚨 Último dia do seu teste grátis!',
    trial_expiring_1day_title: 'Seu teste termina amanhã!',
    trial_expiring_1day_body: 'Este é o último dia do seu período de teste! Ative sua assinatura agora para continuar criando artigos incríveis sem interrupção.',
    trial_expiring_1day_cta: 'Ativar Agora',
    trial_expiring_1day_urgency: 'Não perca seus artigos e configurações!',
    
    // Trial Expired
    trial_expired_subject: '😢 Seu período de teste encerrou',
    trial_expired_title: 'Teste Gratuito Encerrado',
    trial_expired_body: 'Seu período de teste gratuito na Omniseen terminou. Para recuperar o acesso completo à plataforma e continuar gerando artigos, escolha um plano.',
    trial_expired_cta: 'Ver Planos',
    trial_expired_miss: 'Sentimos sua falta! Seus artigos e configurações estão seguros.',
  },
  'en': {
    // Common
    greeting: 'Hello',
    regards: 'Best regards',
    team: 'Omniseen Team',
    footer: 'This email was sent automatically by Omniseen.',
    unsubscribe: 'To stop receiving emails, access your account settings.',
    
    // Welcome
    welcome_subject: 'Welcome to Omniseen! 🎉',
    welcome_title: 'Welcome to Omniseen!',
    welcome_body: 'Your account has been created successfully. We are excited to have you with us!',
    welcome_cta: 'Access Platform',
    
    // Team Invite
    team_invite_subject: 'You have been invited to join the blog {blogName}',
    team_invite_title: 'Team Invitation',
    team_invite_body: '{inviterName} invited you to join the blog "{blogName}" as {role}.',
    team_invite_cta: 'Accept Invitation',
    team_invite_expire: 'This invitation expires in 7 days.',
    
    // Password Reset
    password_reset_subject: 'Password Reset - Omniseen',
    password_reset_title: 'Reset Password',
    password_reset_body: 'We received a request to reset your password. Click the button below to create a new password.',
    password_reset_cta: 'Reset Password',
    password_reset_ignore: 'If you did not request this change, please ignore this email.',
    
    // Article Published
    article_published_subject: 'New article published: {title}',
    article_published_title: 'Article Published!',
    article_published_body: 'The article "{title}" was successfully published on the blog "{blogName}".',
    article_published_cta: 'View Article',
    
    // Weekly Report
    weekly_report_subject: 'Weekly Blog Report - {blogName}',
    weekly_report_title: 'Weekly Report',
    
    // Opportunity Alert
    opportunity_alert_subject: '🎯 New article opportunity with {score}% relevance',
    opportunity_alert_title: 'New Article Opportunity',
    opportunity_alert_body: 'We identified an opportunity with {score}% relevance:',
    opportunity_alert_cta: 'View Opportunity',
    
    // GSC Alert
    gsc_alert_subject: '⚠️ Ranking Alert - {blogName}',
    gsc_alert_title: 'Google Search Console Alert',
    
    // Payment
    payment_reminder_subject: 'Payment Reminder - Omniseen',
    payment_reminder_title: 'Pending Payment',
    
    // Subscription
    subscription_canceled_subject: 'Your subscription has been canceled',
    subscription_canceled_title: 'Subscription Canceled',
    
    // Trial Expiring - 3 days
    trial_expiring_3days_subject: '⏰ Your free trial ends in 3 days',
    trial_expiring_3days_title: '3 days left on your trial',
    trial_expiring_3days_body: 'Your free trial period at Omniseen ends in 3 days. To keep access to your content and continue generating amazing articles, activate your subscription now.',
    trial_expiring_3days_cta: 'Activate Subscription',
    trial_expiring_3days_benefit1: '✅ Keep access to all your articles',
    trial_expiring_3days_benefit2: '✅ Continue generating AI content',
    trial_expiring_3days_benefit3: '✅ No interruptions to your workflow',
    
    // Trial Expiring - 1 day
    trial_expiring_1day_subject: '🚨 Last day of your free trial!',
    trial_expiring_1day_title: 'Your trial ends tomorrow!',
    trial_expiring_1day_body: 'This is the last day of your trial period! Activate your subscription now to continue creating amazing articles without interruption.',
    trial_expiring_1day_cta: 'Activate Now',
    trial_expiring_1day_urgency: "Don't lose your articles and settings!",
    
    // Trial Expired
    trial_expired_subject: '😢 Your trial period has ended',
    trial_expired_title: 'Free Trial Ended',
    trial_expired_body: 'Your free trial period at Omniseen has ended. To regain full access to the platform and continue generating articles, choose a plan.',
    trial_expired_cta: 'View Plans',
    trial_expired_miss: 'We miss you! Your articles and settings are safe.',
  },
  'es': {
    // Common
    greeting: 'Hola',
    regards: 'Saludos',
    team: 'Equipo Omniseen',
    footer: 'Este correo fue enviado automáticamente por Omniseen.',
    unsubscribe: 'Para dejar de recibir correos, accede a la configuración de tu cuenta.',
    
    // Welcome
    welcome_subject: '¡Bienvenido a Omniseen! 🎉',
    welcome_title: '¡Bienvenido a Omniseen!',
    welcome_body: 'Tu cuenta ha sido creada con éxito. ¡Estamos emocionados de tenerte con nosotros!',
    welcome_cta: 'Acceder a la Plataforma',
    
    // Team Invite
    team_invite_subject: 'Has sido invitado a unirte al blog {blogName}',
    team_invite_title: 'Invitación de Equipo',
    team_invite_body: '{inviterName} te invitó a unirte al blog "{blogName}" como {role}.',
    team_invite_cta: 'Aceptar Invitación',
    team_invite_expire: 'Esta invitación expira en 7 días.',
    
    // Password Reset
    password_reset_subject: 'Restablecimiento de Contraseña - Omniseen',
    password_reset_title: 'Restablecer Contraseña',
    password_reset_body: 'Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón a continuación para crear una nueva.',
    password_reset_cta: 'Restablecer Contraseña',
    password_reset_ignore: 'Si no solicitaste este cambio, ignora este correo.',
    
    // Article Published
    article_published_subject: 'Nuevo artículo publicado: {title}',
    article_published_title: '¡Artículo Publicado!',
    article_published_body: 'El artículo "{title}" fue publicado con éxito en el blog "{blogName}".',
    article_published_cta: 'Ver Artículo',
    
    // Weekly Report
    weekly_report_subject: 'Informe Semanal del Blog - {blogName}',
    weekly_report_title: 'Informe Semanal',
    
    // Opportunity Alert
    opportunity_alert_subject: '🎯 Nueva oportunidad de artículo con {score}% de relevancia',
    opportunity_alert_title: 'Nueva Oportunidad de Artículo',
    opportunity_alert_body: 'Identificamos una oportunidad con {score}% de relevancia:',
    opportunity_alert_cta: 'Ver Oportunidad',
    
    // GSC Alert
    gsc_alert_subject: '⚠️ Alerta de Ranking - {blogName}',
    gsc_alert_title: 'Alerta de Google Search Console',
    
    // Payment
    payment_reminder_subject: 'Recordatorio de Pago - Omniseen',
    payment_reminder_title: 'Pago Pendiente',
    
    // Subscription
    subscription_canceled_subject: 'Tu suscripción ha sido cancelada',
    subscription_canceled_title: 'Suscripción Cancelada',
    
    // Trial Expiring - 3 days
    trial_expiring_3days_subject: '⏰ Tu prueba gratis termina en 3 días',
    trial_expiring_3days_title: 'Quedan 3 días de tu prueba',
    trial_expiring_3days_body: 'Tu período de prueba gratuito en Omniseen termina en 3 días. Para no perder acceso a tus creaciones y seguir generando artículos increíbles, activa tu suscripción ahora.',
    trial_expiring_3days_cta: 'Activar Suscripción',
    trial_expiring_3days_benefit1: '✅ Mantén acceso a todos tus artículos',
    trial_expiring_3days_benefit2: '✅ Sigue generando contenido con IA',
    trial_expiring_3days_benefit3: '✅ Sin interrupciones en tu flujo de trabajo',
    
    // Trial Expiring - 1 day
    trial_expiring_1day_subject: '🚨 ¡Último día de tu prueba gratis!',
    trial_expiring_1day_title: '¡Tu prueba termina mañana!',
    trial_expiring_1day_body: '¡Este es el último día de tu período de prueba! Activa tu suscripción ahora para seguir creando artículos increíbles sin interrupción.',
    trial_expiring_1day_cta: 'Activar Ahora',
    trial_expiring_1day_urgency: '¡No pierdas tus artículos y configuraciones!',
    
    // Trial Expired
    trial_expired_subject: '😢 Tu período de prueba terminó',
    trial_expired_title: 'Prueba Gratuita Terminada',
    trial_expired_body: 'Tu período de prueba gratuito en Omniseen ha terminado. Para recuperar el acceso completo a la plataforma y seguir generando artículos, elige un plan.',
    trial_expired_cta: 'Ver Planes',
    trial_expired_miss: '¡Te extrañamos! Tus artículos y configuraciones están seguros.',
  },
};

// Replace variables in text
function replaceVariables(text: string, variables: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

// Get localized text with variable replacement
function t(lang: Language, key: string, variables: Record<string, string> = {}): string {
  const text = locales[lang]?.[key] || locales['en'][key] || key;
  return replaceVariables(text, variables);
}

// Base HTML template
function getBaseTemplate(content: string, lang: Language): string {
  return `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Omniseen</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f7; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px; text-align: center; }
    .header img { height: 40px; }
    .header h1 { color: #ffffff; margin: 16px 0 0 0; font-size: 24px; font-weight: 600; }
    .content { padding: 32px; color: #333333; line-height: 1.6; }
    .content h2 { color: #1f2937; margin-top: 0; }
    .button { display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 16px 0; }
    .button:hover { opacity: 0.9; }
    .footer { padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
    .footer a { color: #6366f1; text-decoration: none; }
    .highlight-box { background-color: #f5f5ff; border-left: 4px solid #6366f1; padding: 16px; margin: 16px 0; border-radius: 0 8px 8px 0; }
    .metric { font-size: 28px; font-weight: 700; color: #6366f1; }
    .divider { border-top: 1px solid #e5e7eb; margin: 24px 0; }
    .benefits-list { list-style: none; padding: 0; margin: 16px 0; }
    .benefits-list li { padding: 8px 0; font-size: 15px; }
    .urgency-box { background-color: #fef3c7; border: 1px solid #f59e0b; padding: 16px; border-radius: 8px; margin: 16px 0; text-align: center; }
    .urgency-box p { margin: 0; color: #92400e; font-weight: 600; }
    .countdown { font-size: 48px; font-weight: 700; color: #6366f1; text-align: center; margin: 24px 0; }
    .countdown span { font-size: 16px; display: block; color: #6b7280; font-weight: normal; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Omniseen</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>${t(lang, 'footer')}</p>
      <p>${t(lang, 'regards')},<br>${t(lang, 'team')}</p>
    </div>
  </div>
</body>
</html>`;
}

// Template generators
function generateWelcomeEmail(lang: Language, variables: Record<string, string>): { subject: string; html: string } {
  const subject = t(lang, 'welcome_subject', variables);
  const content = `
    <h2>${t(lang, 'welcome_title', variables)}</h2>
    <p>${t(lang, 'greeting', variables)} ${variables.userName || ''},</p>
    <p>${t(lang, 'welcome_body', variables)}</p>
    <p style="text-align: center;">
      <a href="${variables.loginUrl || 'https://app.omniseen.app/login'}" class="button">${t(lang, 'welcome_cta', variables)}</a>
    </p>
  `;
  return { subject, html: getBaseTemplate(content, lang) };
}

function generateTeamInviteEmail(lang: Language, variables: Record<string, string>): { subject: string; html: string } {
  const subject = t(lang, 'team_invite_subject', variables);
  const content = `
    <h2>${t(lang, 'team_invite_title', variables)}</h2>
    <p>${t(lang, 'greeting', variables)} ${variables.invitedName || ''},</p>
    <p>${t(lang, 'team_invite_body', variables)}</p>
    <div class="highlight-box">
      <strong>Blog:</strong> ${variables.blogName}<br>
      <strong>Role:</strong> ${variables.role}
    </div>
    <p style="text-align: center;">
      <a href="${variables.inviteUrl}" class="button">${t(lang, 'team_invite_cta', variables)}</a>
    </p>
    <p style="color: #6b7280; font-size: 14px;">${t(lang, 'team_invite_expire', variables)}</p>
  `;
  return { subject, html: getBaseTemplate(content, lang) };
}

function generatePasswordResetEmail(lang: Language, variables: Record<string, string>): { subject: string; html: string } {
  const subject = t(lang, 'password_reset_subject', variables);
  const content = `
    <h2>${t(lang, 'password_reset_title', variables)}</h2>
    <p>${t(lang, 'greeting', variables)},</p>
    <p>${t(lang, 'password_reset_body', variables)}</p>
    <p style="text-align: center;">
      <a href="${variables.resetUrl}" class="button">${t(lang, 'password_reset_cta', variables)}</a>
    </p>
    <p style="color: #6b7280; font-size: 14px;">${t(lang, 'password_reset_ignore', variables)}</p>
  `;
  return { subject, html: getBaseTemplate(content, lang) };
}

function generateArticlePublishedEmail(lang: Language, variables: Record<string, string>): { subject: string; html: string } {
  const subject = t(lang, 'article_published_subject', variables);
  const content = `
    <h2>${t(lang, 'article_published_title', variables)}</h2>
    <p>${t(lang, 'greeting', variables)},</p>
    <p>${t(lang, 'article_published_body', variables)}</p>
    <div class="highlight-box">
      <strong>${variables.title}</strong>
    </div>
    <p style="text-align: center;">
      <a href="${variables.articleUrl}" class="button">${t(lang, 'article_published_cta', variables)}</a>
    </p>
  `;
  return { subject, html: getBaseTemplate(content, lang) };
}

function generateOpportunityAlertEmail(lang: Language, variables: Record<string, string>): { subject: string; html: string } {
  const subject = t(lang, 'opportunity_alert_subject', variables);
  const content = `
    <h2>${t(lang, 'opportunity_alert_title', variables)}</h2>
    <p>${t(lang, 'greeting', variables)},</p>
    <p>${t(lang, 'opportunity_alert_body', variables)}</p>
    <div class="highlight-box">
      <p class="metric">${variables.score}%</p>
      <strong>${variables.title}</strong><br>
      <span style="color: #6b7280;">Keywords: ${variables.keywords}</span>
    </div>
    <p style="text-align: center;">
      <a href="${variables.opportunityUrl}" class="button">${t(lang, 'opportunity_alert_cta', variables)}</a>
    </p>
  `;
  return { subject, html: getBaseTemplate(content, lang) };
}

function generateTrialExpiring3DaysEmail(lang: Language, variables: Record<string, string>): { subject: string; html: string } {
  const subject = t(lang, 'trial_expiring_3days_subject', variables);
  const content = `
    <h2>${t(lang, 'trial_expiring_3days_title', variables)}</h2>
    <p>${t(lang, 'greeting', variables)} ${variables.userName || ''},</p>
    <p>${t(lang, 'trial_expiring_3days_body', variables)}</p>
    <div class="countdown">
      3
      <span>dias restantes</span>
    </div>
    <ul class="benefits-list">
      <li>${t(lang, 'trial_expiring_3days_benefit1', variables)}</li>
      <li>${t(lang, 'trial_expiring_3days_benefit2', variables)}</li>
      <li>${t(lang, 'trial_expiring_3days_benefit3', variables)}</li>
    </ul>
    <p style="text-align: center;">
      <a href="${variables.pricingUrl || 'https://app.omniseen.app/pricing'}" class="button">${t(lang, 'trial_expiring_3days_cta', variables)}</a>
    </p>
  `;
  return { subject, html: getBaseTemplate(content, lang) };
}

function generateTrialExpiring1DayEmail(lang: Language, variables: Record<string, string>): { subject: string; html: string } {
  const subject = t(lang, 'trial_expiring_1day_subject', variables);
  const content = `
    <h2>${t(lang, 'trial_expiring_1day_title', variables)}</h2>
    <p>${t(lang, 'greeting', variables)} ${variables.userName || ''},</p>
    <p>${t(lang, 'trial_expiring_1day_body', variables)}</p>
    <div class="countdown">
      1
      <span>dia restante</span>
    </div>
    <div class="urgency-box">
      <p>${t(lang, 'trial_expiring_1day_urgency', variables)}</p>
    </div>
    <p style="text-align: center;">
      <a href="${variables.pricingUrl || 'https://app.omniseen.app/pricing'}" class="button">${t(lang, 'trial_expiring_1day_cta', variables)}</a>
    </p>
  `;
  return { subject, html: getBaseTemplate(content, lang) };
}

function generateTrialExpiredEmail(lang: Language, variables: Record<string, string>): { subject: string; html: string } {
  const subject = t(lang, 'trial_expired_subject', variables);
  const content = `
    <h2>${t(lang, 'trial_expired_title', variables)}</h2>
    <p>${t(lang, 'greeting', variables)} ${variables.userName || ''},</p>
    <p>${t(lang, 'trial_expired_body', variables)}</p>
    <div class="highlight-box">
      <p>${t(lang, 'trial_expired_miss', variables)}</p>
    </div>
    <p style="text-align: center;">
      <a href="${variables.pricingUrl || 'https://app.omniseen.app/pricing'}" class="button">${t(lang, 'trial_expired_cta', variables)}</a>
    </p>
  `;
  return { subject, html: getBaseTemplate(content, lang) };
}

// Generate email based on template
function generateEmail(template: EmailTemplate, lang: Language, variables: Record<string, string>): { subject: string; html: string } {
  switch (template) {
    case 'welcome':
      return generateWelcomeEmail(lang, variables);
    case 'team_invite':
      return generateTeamInviteEmail(lang, variables);
    case 'password_reset':
      return generatePasswordResetEmail(lang, variables);
    case 'article_published':
      return generateArticlePublishedEmail(lang, variables);
    case 'opportunity_alert':
      return generateOpportunityAlertEmail(lang, variables);
    case 'trial_expiring_3days':
      return generateTrialExpiring3DaysEmail(lang, variables);
    case 'trial_expiring_1day':
      return generateTrialExpiring1DayEmail(lang, variables);
    case 'trial_expired':
      return generateTrialExpiredEmail(lang, variables);
    default:
      return { 
        subject: t(lang, `${template}_subject`, variables), 
        html: getBaseTemplate(`<p>${variables.content || ''}</p>`, lang) 
      };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
    const BREVO_SENDER_EMAIL = Deno.env.get('BREVO_SENDER_EMAIL') || 'noreply@omniseen.app';
    const BREVO_SENDER_NAME = Deno.env.get('BREVO_SENDER_NAME') || 'Omniseen';
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!BREVO_API_KEY) {
      console.error('BREVO_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const request: SendEmailRequest = await req.json();
    const { to, toName, template, language = 'pt-BR', subject: overrideSubject, variables, blogId, userId, htmlContent } = request;

    console.log(`Sending ${template} email to ${to} in ${language}`);

    // Generate email content
    let emailSubject: string;
    let emailHtml: string;

    if (htmlContent) {
      emailSubject = overrideSubject || `Omniseen - ${template}`;
      emailHtml = htmlContent;
    } else {
      const generated = generateEmail(template, language, variables);
      emailSubject = overrideSubject || generated.subject;
      emailHtml = generated.html;
    }

    // Send via Brevo API
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: BREVO_SENDER_NAME,
          email: BREVO_SENDER_EMAIL,
        },
        to: [{ 
          email: to, 
          name: toName || to 
        }],
        subject: emailSubject,
        htmlContent: emailHtml,
      }),
    });

    const brevoResult = await brevoResponse.json();
    console.log('Brevo response:', brevoResult);

    // Log email to database
    const logData = {
      to_email: to,
      to_name: toName,
      template,
      subject: emailSubject,
      language,
      status: brevoResponse.ok ? 'sent' : 'failed',
      brevo_message_id: brevoResult.messageId,
      error_message: brevoResponse.ok ? null : JSON.stringify(brevoResult),
      variables,
      blog_id: blogId || null,
      user_id: userId || null,
    };

    const { error: logError } = await supabase
      .from('email_logs')
      .insert(logData);

    if (logError) {
      console.error('Failed to log email:', logError);
    }

    if (!brevoResponse.ok) {
      console.error('Brevo error:', brevoResult);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: brevoResult }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, messageId: brevoResult.messageId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-email function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
