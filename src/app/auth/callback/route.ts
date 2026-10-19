import {createServerClient} from '@supabase/ssr';
import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseConfig} from '@/lib/supabase/config';

export async function GET(request:NextRequest){
  const code=request.nextUrl.searchParams.get('code');
  const next=request.nextUrl.searchParams.get('next');
  const destination=next==='/auth/reset'?next:'/dashboard';
  const response=NextResponse.redirect(new URL(destination,request.url));
  const authError=request.nextUrl.searchParams.get('error');
  if(authError){
    const failed=new URL('/auth/signin',request.url);
    failed.searchParams.set('auth_error','callback');
    return NextResponse.redirect(failed);
  }
  if(!code){
    const failed=new URL('/auth/signin',request.url);
    failed.searchParams.set('auth_error','callback');
    return NextResponse.redirect(failed);
  }
  const {url:supabaseUrl,key:supabaseKey}=getSupabaseConfig();
  if(!supabaseUrl||!supabaseKey){
    const failed=new URL('/auth/signin',request.url);
    failed.searchParams.set('auth_error','callback');
    return NextResponse.redirect(failed);
  }
  const supabase=createServerClient(supabaseUrl,supabaseKey,{
    cookies:{
      getAll:()=>request.cookies.getAll(),
      setAll:(cookies:{name:string;value:string;options:any}[])=>cookies.forEach(({name,value,options})=>response.cookies.set(name,value,options))
    }
  });
  const {error}=await supabase.auth.exchangeCodeForSession(code);
  if(error){
    const failed=new URL('/auth/signin',request.url);
    failed.searchParams.set('auth_error','callback');
    return NextResponse.redirect(failed);
  }
  return response;
}
