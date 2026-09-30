const form=document.getElementById('deletion-form');
const input=document.getElementById('recovery-code');
const button=form.querySelector('button');
const status=document.getElementById('request-status');
let busy=false;
form.addEventListener('submit',async event=>{
 event.preventDefault();if(busy||!form.reportValidity())return;
 let code=input.value.trim();input.value='';
 const [memberId,recoveryToken]=code.split(':');code='';
 busy=true;button.disabled=true;form.setAttribute('aria-busy','true');
 status.dataset.error='false';status.textContent='Sending your request…';
 try{
  const response=await fetch('/api/skyline/deletion-request/recovery',{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({memberId,recoveryToken}),signal:AbortSignal.timeout(20000)});
  if(!response.ok){
   if(response.status===401)throw new Error('That recovery code was not accepted. Check the full code and try again.');
   if(response.status===429)throw new Error('Too many attempts. Please wait before trying again.');
   throw new Error('Your request was not confirmed. Keep your recovery code and try again later.');
  }
  const result=await response.json();
  if(result.status!=='pending'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(result.requestId??''))throw new Error('Your request was not confirmed. Keep your recovery code and try again later.');
  status.textContent=`Request recorded. Your account is still active until this is processed.\nReference: ${result.requestId}`;
  form.reset();
 }catch(error){
  status.dataset.error='true';status.textContent=error instanceof Error&&error.name!=='TimeoutError'&&error.name!=='TypeError'?error.message:'Your request was not confirmed. Check your connection and try again. Retrying keeps the same request reference.';
 }finally{busy=false;button.disabled=false;form.removeAttribute('aria-busy');}
});
