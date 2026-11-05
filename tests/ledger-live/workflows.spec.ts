import { test, expect, Page } from "@playwright/test";
import fs from "node:fs";
// Real API only: no page.route(), no fabricated responses. Run against an isolated DB clone.
const authPath=process.env.IFMS_LIVE_AUTH_FILE;
test.skip(!authPath,"Set IFMS_LIVE_AUTH_FILE to temporary credentials for the isolated backend at localhost:8080");
type Auth={accessToken:string;refreshToken:string;user:unknown};
function auth(role="ACCOUNTANT"):Auth{return JSON.parse(fs.readFileSync(authPath!,"utf8"))[role];}
async function get(path:string,role="ACCOUNTANT") {const r=await fetch(`http://127.0.0.1:8080/api/v1${path}`,{headers:{Authorization:`Bearer ${auth(role).accessToken}`}});expect(r.status,path).toBe(200);return (await r.json()).data;}
async function login(page:Page,role="ACCOUNTANT") {const a=auth(role);await page.context().addCookies([{name:"access_token",value:a.accessToken,url:"http://127.0.0.1:3100"}]);await page.addInitScript(a=>{localStorage.setItem("access_token",a.accessToken);localStorage.setItem("refresh_token",a.refreshToken);localStorage.setItem("user_info",JSON.stringify(a.user));},a);}
for(const [kind,label,prefix] of [["REQUEST","Xem yêu cầu","/accountant/ledger/sources/requests/"],["PAYSLIP","Xem phiếu lương","/accountant/payslips/"]]) {
 test(`Wallet ${kind} opens the accountant source belonging to another employee`,async({page})=>{
  const a=auth() as Auth&{user:{id:number}};const list=await get("/accountant/ledger/wallet-transactions?limit=100");let tx;
  for(const row of list.items){const detail=await get(`/accountant/ledger/${row.id}`);if(detail.referenceType===kind){if(kind==="PAYSLIP"){const slip=await get(`/accountant/payslips/${detail.referenceId}`);if(slip.userId===a.user.id)continue;}tx=detail;break;}}
  expect(tx,`Seed ${kind} source in the isolated clone`).toBeTruthy();await login(page);await page.goto(`/accountant/ledger/${tx.id}`);
  const link=page.getByRole("link",{name:`${label} #${tx.referenceId}`,exact:true});await expect(link).toHaveAttribute("href",`${prefix}${tx.referenceId}`);await link.click();await expect(page).toHaveURL(new RegExp(`${prefix}${tx.referenceId}$`));
  await expect(page.getByRole("heading",{name:/Không tìm thấy/})).toHaveCount(0);await expect(page.locator('[role="alert"]').filter({hasText:/Không tìm|Không thể tải|Không tải được/})).toHaveCount(0);
  if(kind==="REQUEST"){await expect(page.getByText("Số tiền được duyệt",{exact:true})).toBeVisible();await expect(page.getByRole("link",{name:"Xem các bút toán của yêu cầu"})).toHaveAttribute("href",`/accountant/ledger?tab=journal&requestId=${tx.referenceId}`);}
 });
}
test("Ledger and financial branches load with real authenticated APIs",async({page})=>{
 await login(page);const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 for(const path of ["/accountant/ledger?tab=wallet","/accountant/ledger?tab=journal","/accountant/ledger?tab=advances","/accountant/ledger?tab=budget","/accountant/ledger/accounts","/accountant/system-fund","/accountant/ledger/reconciliation","/accountant/ledger/cost-reconciliation","/accountant/ledger/history","/accountant/ledger/periods","/data-exchange"]){
  const api=page.waitForResponse(r=>r.url().includes("/api/v1/")&&!r.url().includes("notifications"));await page.goto(path);expect((await api).status(),path).toBe(200);await expect(page.getByRole("heading").first()).toBeVisible();}
 expect(errors).toEqual([]);
});
test("Journal account totals match real server reports",async({page})=>{
 const report=await get("/accountant/ledger/accounts");expect(report.totalDebit).toBe(report.totalCredit);const journals=await get("/accountant/ledger/journals");expect(journals.items.length,"Create journals through the financial workflow before this test").toBeGreaterThan(0);
 const journal=await get(`/accountant/ledger/journals/${journals.items[0].id}`);expect(journal.totalDebit).toBe(journal.totalCredit);expect(journal.balanced).toBe(true);await login(page);await page.goto(`/accountant/ledger/journals/${journal.id}`);await expect(page.getByText("Bút toán cân bằng",{exact:true})).toBeVisible();
});
test("Excel exports respect each role with real binary workbooks",async()=>{
 let count=0;for(const role of ["ACCOUNTANT","CFO","MANAGER","TEAM_LEADER","EMPLOYEE","ADMIN"]){for(const ds of await get("/spreadsheets",role)){
 let query="";if(ds.scopeLabel){const scopes=await get(`/spreadsheets/${ds.code}/scopes`,role);if(!scopes.length)continue;query=`?scope=${scopes[0].id}`;}
 const r=await fetch(`http://127.0.0.1:8080/api/v1/spreadsheets/${ds.code}/export${query}`,{headers:{Authorization:`Bearer ${auth(role).accessToken}`}});expect(r.status,`${role}/${ds.code}`).toBe(200);expect(r.headers.get("content-type")).toContain("spreadsheetml");const bytes=new Uint8Array(await r.arrayBuffer());expect(Array.from(bytes.slice(0,2))).toEqual([80,75]);count++;}}
 expect(count).toBeGreaterThan(50);
});

test("Payroll replacement displays only effective totals and marks reversed originals",async({page})=>{
 const list=await get("/accountant/payroll?limit=100");let period;for(const row of list.items){const detail=await get(`/accountant/payroll/${row.id}`);if(detail.entries.some((e:{status:string})=>e.status==="REVERSED")){period=detail;break;}}
 expect(period,"Prepare a payroll correction on the isolated clone").toBeTruthy();const effective=period.entries.filter((e:{status:string})=>e.status!=="REVERSED").reduce((n:number,e:{finalNetSalary:number})=>n+e.finalNetSalary,0);expect(period.totalNetPayroll).toBe(effective);await login(page);await page.goto(`/accountant/payroll/${period.id}`);await expect(page.getByText(`${period.employeeCount} người`,{exact:true}).first()).toBeVisible();const original=period.entries.find((e:{status:string})=>e.status==="REVERSED");await page.goto(`/accountant/payslips/${original.id}`);await expect(page.getByText("Đã đảo",{exact:true})).toBeVisible();await expect(page.getByRole("status").filter({hasText:"không được cộng"})).toBeVisible();
});

test("Expense verification and payment notifications persist and open the source request",async({page})=>{
 const result=await get("/notifications?limit=100","EMPLOYEE");
 const paid=result.items.find((item:{type:string})=>item.type==="EXPENSE_PAID");
 const verified=result.items.find((item:{type:string;refId:number})=>item.type==="EXPENSE_VERIFIED"&&item.refId===paid?.refId);
 expect(paid,"Complete an expense on the isolated clone before this test").toBeTruthy();
 expect(verified).toBeTruthy();
 expect(paid.referenceLink).toBe(`/requests/${paid.refId}`);
 expect(verified.referenceLink).toBe(`/requests/${paid.refId}`);
 await login(page,"EMPLOYEE");await page.goto("/notifications");
 await expect(page.getByText("Khoản hoàn chi đã được thanh toán",{exact:true}).first()).toBeVisible();
});
