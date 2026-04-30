import { createClient } from '@supabase/supabase-js';

function supabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  try {
    const { data, error } = await supabase()
      .from('simulator_data')
      .select('data')
      .eq('id', 'main')
      .single();
    if (error || !data) return new Response(null, { status: 404 });
    return Response.json(data.data);
  } catch (err) {
    return new Response(String(err), { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { error } = await supabase()
      .from('simulator_data')
      .upsert({ id: 'main', data: body, updated_at: new Date().toISOString() });
    if (error) return new Response(error.message, { status: 500 });
    return new Response('ok');
  } catch (err) {
    return new Response(String(err), { status: 500 });
  }
}
