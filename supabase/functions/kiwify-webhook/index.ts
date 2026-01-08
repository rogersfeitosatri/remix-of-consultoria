import { createClient } from "npm:@supabase/supabase-js@2";

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

// Function to create user account for athlete
async function createAthleteUser(supabase: any, email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
    });

    if (error) {
      console.error('Error creating user account:', error);
      return null;
    }

    console.log('User account created:', data.user?.id);
    
    // Add athlete role
    if (data.user) {
      await supabase.from('user_roles').insert({
        user_id: data.user.id,
        role: 'athlete',
      });
      console.log('Athlete role assigned to user:', data.user.id);
    }

    return data.user;
  } catch (error) {
    console.error('Error in createAthleteUser:', error);
    return null;
  }
}

// Function to create client automatically from Kiwify purchase
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

  // Create user account for athlete with temporary password
  const temporaryPassword = '123456';
  const athleteUser = await createAthleteUser(supabase, purchaseData.email, temporaryPassword);

  // All Kiwify plans are 6 weeks duration
  const productPrice = purchaseData.amount || 97;
  
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 42); // 6 weeks = 42 days

  // Determine payment type from Kiwify data
  const paymentMethod = purchaseData.payment_method?.toLowerCase() || '';
  const paymentType = paymentMethod.includes('pix') ? 'pix' : 'card';

  const clientData = {
    user_id: adminUserId,
    name: purchaseData.name || 'Cliente Kiwify',
    email: purchaseData.email,
    phone: purchaseData.phone,
    service_type: 'nutrition', // Default to nutrition
    plan_type: 'consultoria', // Kiwify plans are always consultoria
    plan_duration: 'six_weeks', // Kiwify plans are always 6 weeks
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    monthly_value: productPrice,
    payment_type: paymentType,
    payment_date: startDate.toISOString().split('T')[0],
    is_active: true,
    has_checkin: true,
    checkin_frequency: 'biweekly', // Kiwify plans have biweekly checkin
    has_consultations: false, // Kiwify plans have no consultations
    consultation_count: 0,
    athlete_status: 'pending_anamnese',
    registration_source: 'kiwify',
    athlete_user_id: athleteUser?.id || null,
    notes: `Compra automática via Kiwify.\nProduto: ${purchaseData.product_name || 'N/A'}\nOrder ID: ${purchaseData.order_id || 'N/A'}\nValor: R$ ${productPrice}\nForma de pagamento: ${paymentType === 'pix' ? 'PIX' : 'Cartão'}`,
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

  // Create initial payment record as PAID (already paid via Kiwify)
  try {
    await supabase.from('payments').insert({
      user_id: adminUserId,
      client_id: newClient.id,
      due_date: startDate.toISOString().split('T')[0],
      amount: productPrice,
      status: 'paid',
      paid_at: new Date().toISOString(),
    });
    console.log('Payment record created for client:', newClient.id);
  } catch (paymentError) {
    console.error('Error creating payment:', paymentError);
  }

  // Generate scheduled checkins
  try {
    const checkinSchedules = generateCheckinSchedules(
      adminUserId,
      newClient.id,
      clientData.start_date,
      clientData.end_date,
      'biweekly' // Biweekly checkin for Kiwify clients
    );

    if (checkinSchedules.length > 0) {
      await supabase.from('scheduled_checkins').insert(checkinSchedules);
      console.log(`Created ${checkinSchedules.length} scheduled checkins for client:`, newClient.id);
    }
  } catch (checkinError) {
    console.error('Error creating scheduled checkins:', checkinError);
  }

  return { client: newClient, athleteUser, temporaryPassword };
}

// Helper function to calculate first valid Monday for checkin
// Rule: If next Monday is less than 6 days away, skip to the following Monday
function calculateFirstCheckinMonday(startDate: Date): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const baseDate = startDate < today ? today : new Date(startDate);
  baseDate.setHours(0, 0, 0, 0);
  
  // Get the next Monday from baseDate
  const dayOfWeek = baseDate.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  
  let firstMonday = new Date(baseDate);
  firstMonday.setDate(baseDate.getDate() + daysUntilMonday);
  
  // Calculate days until this Monday
  const diffTime = firstMonday.getTime() - baseDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // If less than 6 days until the Monday, skip to the next Monday
  if (diffDays < 6) {
    firstMonday.setDate(firstMonday.getDate() + 7);
  }
  
  return firstMonday;
}

// Generate scheduled checkins based on client's plan
function generateCheckinSchedules(
  userId: string,
  clientId: string,
  startDate: string,
  endDate: string,
  checkinFrequency: string
): { client_id: string; user_id: string; form_id: null; scheduled_send_date: string; scheduled_send_time: string; status: string; sent_at: null; response_id: null; notes: null }[] {
  const schedules: any[] = [];
  
  const planStart = new Date(startDate);
  const planEnd = new Date(endDate);
  
  // Calculate first valid Monday
  let currentMonday = calculateFirstCheckinMonday(planStart);
  
  // Frequency in weeks
  const frequencyWeeks: Record<string, number> = {
    daily: 1, // Still send on Mondays only
    weekly: 1,
    biweekly: 2,
    monthly: 4,
    bimonthly: 8,
    quarterly: 12,
  };
  
  const weeksBetween = frequencyWeeks[checkinFrequency] || 1;
  
  while (currentMonday <= planEnd) {
    schedules.push({
      client_id: clientId,
      user_id: userId,
      form_id: null,
      scheduled_send_date: currentMonday.toISOString().split('T')[0],
      scheduled_send_time: '07:00:00',
      status: 'pending',
      sent_at: null,
      response_id: null,
      notes: null,
    });
    
    // Move to next scheduled Monday
    currentMonday.setDate(currentMonday.getDate() + weeksBetween * 7);
  }
  
  return schedules;
}

Deno.serve(async (req) => {
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
    const subscription = payload.Subscription || payload.subscription || {};
    const commissions = payload.Commissions || payload.commissions || {};

    // Extract payment information
    const charges = commissions.charges || [];
    const productValue = product.product_value || order.product_value || charges[0]?.amount || 97;
    const paymentMethod = charges[0]?.payment_method || order.payment_method || payload.payment_method || 'card';

    const purchaseData = {
      email: customer.email || payload.email,
      name: customer.full_name || customer.name || payload.name,
      phone: customer.mobile || customer.phone || payload.phone,
      product_id: product.id || payload.product_id,
      product_name: product.name || payload.product_name,
      order_id: order.order_id || payload.order_id || payload.id,
      status: eventType === 'order_approved' || eventType === 'approved' ? 'approved' : eventType,
      purchase_date: order.created_at || payload.created_at || new Date().toISOString(),
      amount: parseFloat(productValue) || 97, // Used for client creation, not stored in kiwify_purchases
      payment_method: paymentMethod, // Used for client creation, not stored in kiwify_purchases
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

    // Prepare data for kiwify_purchases table (without amount and payment_method which don't exist in the table)
    const purchaseRecordData = {
      email: purchaseData.email,
      name: purchaseData.name,
      phone: purchaseData.phone,
      product_id: purchaseData.product_id,
      product_name: purchaseData.product_name,
      order_id: purchaseData.order_id,
      status: purchaseData.status,
      purchase_date: purchaseData.purchase_date,
      webhook_data: purchaseData.webhook_data,
    };

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
      .insert(purchaseRecordData)
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
      const result = await createClientFromPurchase(supabase, purchaseData);

      // Send WhatsApp notification with credentials if phone is available
      if (purchaseData.phone && result) {
        const appUrl = Deno.env.get('APP_URL') || 'https://vhzxnatgwravidvbehwi.lovableproject.com';
        
        const message = `✅ *Pagamento confirmado!*

Olá, ${purchaseData.name || 'atleta'}!

Seu acesso à *Área do Atleta* foi liberado com sucesso! 🎉

📧 *Email:* ${purchaseData.email}
🔐 *Senha temporária:* 123456

⚠️ *Importante:* Recomendamos que você altere sua senha após o primeiro acesso.

🔗 *Acesse sua área:* ${appUrl}/auth

Para iniciar o seu acompanhamento, é necessário preencher a *anamnese inicial obrigatória*.

Acesse sua área e complete o cadastro para começarmos! 💪

_Equipe de Acompanhamento_`;

        await sendWhatsAppMessage(purchaseData.phone, message);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          purchase: insertedPurchase,
          client: result?.client,
          userCreated: !!result?.athleteUser,
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
