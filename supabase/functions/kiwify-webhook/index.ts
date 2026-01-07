import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Function to send WhatsApp message via Z-API
async function sendWhatsAppMessage(phone: string, message: string) {
  const instanceId = Deno.env.get('ZAPI_INSTANCE_ID');
  const token = Deno.env.get('ZAPI_TOKEN');
  const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

  if (!instanceId || !token) {
    console.log('Z-API credentials not configured, skipping WhatsApp message');
    return null;
  }

  // Format phone number (remove non-digits and ensure country code)
  let formattedPhone = phone.replace(/\D/g, '');
  if (!formattedPhone.startsWith('55')) {
    formattedPhone = '55' + formattedPhone;
  }

  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': clientToken || '',
      },
      body: JSON.stringify({
        phone: formattedPhone,
        message: message,
      }),
    });

    const result = await response.json();
    console.log('Z-API response:', result);
    return result;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return null;
  }
}

// Function to create client automatically
async function createClientFromPurchase(supabase: any, purchaseData: any) {
  // Get the first admin user to be the owner of this client
  const { data: adminRole } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'admin')
    .limit(1)
    .single();

  if (!adminRole) {
    console.log('No admin user found, cannot create client automatically');
    return null;
  }

  const adminUserId = adminRole.user_id;

  // Check if client already exists with this email
  const { data: existingClient } = await supabase
    .from('clients')
    .select('id')
    .eq('email', purchaseData.email)
    .eq('user_id', adminUserId)
    .maybeSingle();

  if (existingClient) {
    console.log('Client already exists:', existingClient.id);
    return existingClient;
  }

  // Create new client
  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1); // Default 1 month plan

  const clientData = {
    user_id: adminUserId,
    name: purchaseData.name || 'Cliente Kiwify',
    email: purchaseData.email,
    phone: purchaseData.phone,
    service_type: 'online',
    plan_type: purchaseData.product_name || 'Plano Kiwify',
    plan_duration: 'monthly',
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    monthly_value: 0, // Will be updated by admin
    is_active: true,
    athlete_status: 'pending_anamnese',
    notes: `Compra automática via Kiwify. Produto: ${purchaseData.product_name || 'N/A'}. Order ID: ${purchaseData.order_id || 'N/A'}`,
  };

  const { data: newClient, error } = await supabase
    .from('clients')
    .insert(clientData)
    .select()
    .single();

  if (error) {
    console.error('Error creating client:', error);
    return null;
  }

  console.log('Client created successfully:', newClient);
  return newClient;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get('KIWIFY_WEBHOOK_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Parse the webhook payload
    const payload = await req.json();
    console.log('Kiwify webhook received:', JSON.stringify(payload, null, 2));

    // Validate webhook signature if secret is configured
    const signatureHeader = req.headers.get('x-kiwify-signature') || req.headers.get('signature');
    
    if (webhookSecret && signatureHeader) {
      // Kiwify sends the signature in the header
      if (signatureHeader !== webhookSecret) {
        console.error('Invalid webhook signature');
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create Supabase client with service role key for admin access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract data from Kiwify webhook
    // Kiwify sends different event types: order_approved, order_refunded, etc.
    const eventType = payload.order_status || payload.event || 'approved';
    const customer = payload.Customer || payload.customer || {};
    const product = payload.Product || payload.product || {};
    const order = payload.Order || payload.order || {};

    const purchaseData = {
      email: customer.email || payload.email,
      name: customer.full_name || customer.name || payload.name,
      phone: customer.mobile || customer.phone || payload.phone,
      product_id: product.id || payload.product_id,
      product_name: product.name || payload.product_name,
      order_id: order.order_id || payload.order_id || payload.id,
      status: eventType === 'order_approved' || eventType === 'approved' ? 'approved' : eventType,
      purchase_date: order.created_at || payload.created_at || new Date().toISOString(),
      webhook_data: payload,
    };

    console.log('Processed purchase data:', purchaseData);

    // Validate required fields
    if (!purchaseData.email) {
      console.error('Missing required field: email');
      return new Response(
        JSON.stringify({ error: 'Missing required field: email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if purchase already exists (by order_id)
    if (purchaseData.order_id) {
      const { data: existingPurchase } = await supabase
        .from('kiwify_purchases')
        .select('id')
        .eq('order_id', purchaseData.order_id)
        .maybeSingle();

      if (existingPurchase) {
        console.log('Purchase already exists, updating status');
        const { error: updateError } = await supabase
          .from('kiwify_purchases')
          .update({ 
            status: purchaseData.status,
            webhook_data: purchaseData.webhook_data
          })
          .eq('order_id', purchaseData.order_id);

        if (updateError) {
          console.error('Error updating purchase:', updateError);
          return new Response(
            JSON.stringify({ error: 'Error updating purchase', details: updateError }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Purchase updated' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Insert new purchase
    const { data: insertedPurchase, error: insertError } = await supabase
      .from('kiwify_purchases')
      .insert(purchaseData)
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting purchase:', insertError);
      return new Response(
        JSON.stringify({ error: 'Error inserting purchase', details: insertError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Purchase inserted successfully:', insertedPurchase);

    // If payment is approved, create client and send WhatsApp message
    if (purchaseData.status === 'approved') {
      // Create client automatically
      const client = await createClientFromPurchase(supabase, purchaseData);

      // Send WhatsApp notification if phone is available
      if (purchaseData.phone) {
        const message = `✅ *Pagamento confirmado!*

Olá, ${purchaseData.name || 'atleta'}!

Seu acesso à *Área do Atleta* foi liberado com sucesso! 🎉

Para iniciar o seu acompanhamento, é necessário preencher a *anamnese inicial obrigatória*.

Acesse sua área e complete o cadastro para começarmos! 💪

_Equipe de Acompanhamento_`;

        await sendWhatsAppMessage(purchaseData.phone, message);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          purchase: insertedPurchase,
          client: client,
          message: 'Purchase recorded, client created and notification sent'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, purchase: insertedPurchase }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
