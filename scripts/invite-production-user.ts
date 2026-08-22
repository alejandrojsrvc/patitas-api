import { config as loadEnv } from 'dotenv';
import { SupabaseAdminInvitationAdapter } from '../src/infrastructure/identity/supabase/supabase-admin-invitation.adapter';

loadEnv({ path: ['.env.supabase.local', '.env.local', '.env'], quiet: true });

const email = readArgument('--email').trim().toLowerCase();
const confirmation = readArgument('--confirm').trim().toLowerCase();
const redirectTo = readArgument('--redirect-to').trim();

if (!isEmail(email) || confirmation !== email) {
  throw new Error(
    'Debes proporcionar un email válido y repetirlo exactamente con --confirm.',
  );
}

const supabaseUrl = requiredEnvironment('SUPABASE_URL');
const secretKey = requiredEnvironment('SUPABASE_SECRET_KEY');
const adapter = new SupabaseAdminInvitationAdapter(supabaseUrl, secretKey);

const main = async (): Promise<void> => {
  const identity = await adapter.inviteUser(email, redirectTo);
  console.info(
    `Invitación creada para ${identity.email} (${identity.providerUserId}).`,
  );
  console.info(
    'El usuario debe aceptar la invitación e iniciar sesión para provisionar su cuenta local.',
  );
};

void main();

function readArgument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`Falta el argumento ${name}.`);
  return value;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`La variable ${name} es obligatoria.`);
  return value;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
