import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const createServiceRoleClient = () => {
  return createBrowserClient(supabaseUrl, supabaseServiceRoleKey);
};
