import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LimitsRequest {
  userId: string;
  action: 'check' | 'increment';
  resource: 'articles' | 'images' | 'keywords' | 'ebooks' | 'blogs' | 'team_members' | 'territories' | 'radar';
}

// Plan limits - using DB enum names (essential/plus/scale)
// Display names: essential=Lite, plus=Pro, scale=Business
// Updated according to NEW TERRITORIAL MODEL (Jan 2026)
const PLAN_LIMITS = {
  // Primary plans (DB enum values) - TERRITORIAL MODEL
  essential: { 
    articles_per_month: 8,
    images_per_month: 8,
    blogs_limit: 1, 
    keywords_limit: 50, 
    team_members: 1,
    territories_limit: 1,      // 1 territory
    ebooks_per_month: 0,
    radar_searches: 0,         // No Radar access
    funnel_enabled: false,
    chat_ai_enabled: false,
    clusters_enabled: false,
  },
  plus: { 
    articles_per_month: 20,
    images_per_month: 20,
    blogs_limit: 1, 
    keywords_limit: 150, 
    team_members: 5,           // Updated: 5 seats
    territories_limit: 2,      // 2 territories
    ebooks_per_month: 1,
    radar_searches: 10,        // 10 searches/month
    funnel_enabled: true,
    chat_ai_enabled: true,
    clusters_enabled: true,
  },
  scale: { 
    articles_per_month: 100,   // Updated: 100 total
    images_per_month: 100,
    blogs_limit: 5,            // Updated: 5 blogs
    keywords_limit: 300,
    team_members: 20,          // Updated: 20 seats
    territories_limit: 10,     // 10 territories
    ebooks_per_month: 4,
    radar_searches: 30,        // 30 searches/month per blog
    funnel_enabled: true,
    chat_ai_enabled: true,
    clusters_enabled: true,
  },
  // Aliases for display names (in case they get stored)
  lite: { 
    articles_per_month: 8,
    images_per_month: 8,
    blogs_limit: 1, 
    keywords_limit: 50, 
    team_members: 1,
    territories_limit: 1,
    ebooks_per_month: 0,
    radar_searches: 0,
    funnel_enabled: false,
    chat_ai_enabled: false,
    clusters_enabled: false,
  },
  pro: { 
    articles_per_month: 20,
    images_per_month: 20,
    blogs_limit: 1, 
    keywords_limit: 150, 
    team_members: 5,
    territories_limit: 2,
    ebooks_per_month: 1,
    radar_searches: 10,
    funnel_enabled: true,
    chat_ai_enabled: true,
    clusters_enabled: true,
  },
  business: { 
    articles_per_month: 100,
    images_per_month: 100,
    blogs_limit: 5, 
    keywords_limit: 300,
    team_members: 20,
    territories_limit: 10,
    ebooks_per_month: 4,
    radar_searches: 30,
    funnel_enabled: true,
    chat_ai_enabled: true,
    clusters_enabled: true,
  },
  // Internal accounts - unlimited everything
  internal: {
    articles_per_month: -1,
    images_per_month: -1,
    blogs_limit: -1,
    keywords_limit: -1,
    team_members: -1,
    territories_limit: -1,
    ebooks_per_month: -1,
    radar_searches: -1,
    funnel_enabled: true,
    chat_ai_enabled: true,
    clusters_enabled: true,
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, action = 'check', resource = 'articles' }: LimitsRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!action || !['check', 'increment'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan, status, trial_ends_at, is_internal_account')
      .eq('user_id', userId)
      .single();

    // No subscription = blocked (no free plan exists)
    if (!subscription) {
      return new Response(
        JSON.stringify({ 
          error: 'No active subscription',
          plan: null,
          isBlocked: true,
          limitReached: true,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Internal accounts bypass all limits
    if (subscription.plan === 'internal' || subscription.is_internal_account) {
      return new Response(
        JSON.stringify({
          plan: 'internal',
          isUnlimited: true,
          limitReached: false,
          remaining: -1,
          limits: PLAN_LIMITS.internal,
          usage: {},
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine plan - only allow active or trialing status
    const isActive = subscription.status === 'active' || subscription.status === 'trialing' || subscription.status === 'past_due';
    if (!isActive) {
      return new Response(
        JSON.stringify({ 
          error: 'Subscription not active',
          plan: subscription.plan,
          status: subscription.status,
          isBlocked: true,
          limitReached: true,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const plan = subscription.plan || 'essential';
    const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.essential;

    // Get or create usage tracking for current month
    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
    
    let { data: usage } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_id', userId)
      .eq('month', currentMonth)
      .single();

    if (!usage) {
      // Use upsert to handle race conditions when multiple requests try to create the same row
      const { data: newUsage, error: upsertError } = await supabase
        .from('usage_tracking')
        .upsert({
          user_id: userId,
          month: currentMonth,
          articles_generated: 0,
          articles_limit: limits.articles_per_month,
          images_generated: 0,
          keywords_used: 0,
          keywords_limit: limits.keywords_limit,
          ebooks_generated: 0,
          ebooks_limit: limits.ebooks_per_month,
          blogs_count: 0,
          blogs_limit: limits.blogs_limit,
          team_members_count: 0,
          team_members_limit: limits.team_members,
          territories_count: 0,
          radar_searches_used: 0,
        }, { 
          onConflict: 'user_id,month',
          ignoreDuplicates: true 
        })
        .select()
        .single();

      if (upsertError) {
        // If upsert fails, try to fetch the existing row (another request may have created it)
        const { data: existingUsage } = await supabase
          .from('usage_tracking')
          .select('*')
          .eq('user_id', userId)
          .eq('month', currentMonth)
          .single();
        
        if (existingUsage) {
          usage = existingUsage;
        } else {
          console.error('Error creating/fetching usage tracking:', upsertError);
          throw upsertError;
        }
      } else {
        usage = newUsage;
      }
    }

    // Map resource to usage fields
    const resourceMap: Record<string, { used: string; limit: number }> = {
      articles: { used: 'articles_generated', limit: limits.articles_per_month },
      images: { used: 'images_generated', limit: limits.images_per_month },
      keywords: { used: 'keywords_used', limit: limits.keywords_limit },
      ebooks: { used: 'ebooks_generated', limit: limits.ebooks_per_month },
      blogs: { used: 'blogs_count', limit: limits.blogs_limit },
      team_members: { used: 'team_members_count', limit: limits.team_members },
      territories: { used: 'territories_count', limit: limits.territories_limit },
      radar: { used: 'radar_searches_used', limit: limits.radar_searches },
    };

    const resourceConfig = resourceMap[resource] || resourceMap.articles;
    const currentUsed = (usage as any)[resourceConfig.used] || 0;
    const resourceLimit = resourceConfig.limit;
    const isUnlimited = resourceLimit === -1;
    const limitReached = !isUnlimited && currentUsed >= resourceLimit;

    if (action === 'check') {
      return new Response(
        JSON.stringify({
          plan,
          limits: {
            articles_limit: limits.articles_per_month,
            images_limit: limits.images_per_month,
            keywords_limit: limits.keywords_limit,
            ebooks_limit: limits.ebooks_per_month,
            blogs_limit: limits.blogs_limit,
            team_members_limit: limits.team_members,
            territories_limit: limits.territories_limit,
            radar_limit: limits.radar_searches,
          },
          usage: {
            articles_used: usage.articles_generated || 0,
            images_used: usage.images_generated || 0,
            keywords_used: usage.keywords_used || 0,
            ebooks_used: usage.ebooks_generated || 0,
            blogs_used: usage.blogs_count || 0,
            team_members_used: usage.team_members_count || 0,
            territories_used: (usage as any).territories_count || 0,
            radar_used: (usage as any).radar_searches_used || 0,
          },
          resource,
          limitReached,
          isUnlimited,
          remaining: isUnlimited ? -1 : Math.max(0, resourceLimit - currentUsed),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: increment
    if (limitReached) {
      return new Response(
        JSON.stringify({
          error: 'Limit reached',
          plan,
          limitReached: true,
          isUnlimited: false,
          remaining: 0,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Increment the specific resource counter
    const updateData: Record<string, number> = {};
    updateData[resourceConfig.used] = currentUsed + 1;

    const { error: updateError } = await supabase
      .from('usage_tracking')
      .update(updateData)
      .eq('id', usage.id);

    if (updateError) {
      console.error('Error updating usage:', updateError);
      throw updateError;
    }

    console.log(`Incremented ${resource} for user ${userId}: ${currentUsed + 1}/${resourceLimit === -1 ? '∞' : resourceLimit}`);

    return new Response(
      JSON.stringify({
        success: true,
        plan,
        resource,
        newCount: currentUsed + 1,
        remaining: isUnlimited ? -1 : Math.max(0, resourceLimit - currentUsed - 1),
        limitReached: !isUnlimited && (currentUsed + 1) >= resourceLimit,
        isUnlimited,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-limits:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
