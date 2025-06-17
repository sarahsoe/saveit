// Check environment variables
const requiredEnvVars = [
  'ANTHROPIC_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
];

console.log('🔍 Checking environment variables...\n');

let allVarsPresent = true;

for (const envVar of requiredEnvVars) {
  const value = process.env[envVar];
  const isPresent = !!value;
  const isValid = envVar === 'ANTHROPIC_API_KEY' 
    ? value?.startsWith('sk-ant-api03-')
    : true;

  console.log(`${envVar}:`);
  console.log(`  Present: ${isPresent ? '✅' : '❌'}`);
  if (isPresent) {
    console.log(`  Valid: ${isValid ? '✅' : '❌'}`);
    if (envVar === 'ANTHROPIC_API_KEY') {
      console.log(`  Format: ${value?.substring(0, 15)}...`);
    }
  }
  console.log('');

  if (!isPresent || !isValid) {
    allVarsPresent = false;
  }
}

if (!allVarsPresent) {
  console.log('❌ Some environment variables are missing or invalid.');
  console.log('\nTo fix this:');
  console.log('1. Go to your Vercel dashboard');
  console.log('2. Click on your project');
  console.log('3. Go to Settings > Environment Variables');
  console.log('4. Add or update the missing variables');
  console.log('5. Redeploy your project');
  process.exit(1);
} else {
  console.log('✅ All environment variables are present and valid!');
} 