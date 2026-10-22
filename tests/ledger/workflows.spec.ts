import { test, expect, Page } from "@playwright/test";
// Browser-only regression fixtures. Product screens still call their normal APIs.
// Financial data and authorization are separately verified against PostgreSQL integration tests.
async function setup(page:Page,role="ACCOUNTANT",historyError=false){
 const token=`fixture.${Buffer.from(JSON.stringify({sub:"ui-fixture",exp:4102444800})).toString("base64url")}.fixture`;
 await page.context().addCookies([{name:"access_token",value:token,url:"http://127.0.0.1:3100"}]);
 await page.addInitScript(({token,role})=>{localStorage.setItem("access_token",token);localStorage.setItem("user_info",JSON.stringify({id:1,fullName:"UI regression fixture",email:"ui@integration.invalid",role,isFirstLogin:false,status:"ACTIVE"}));},{token,role});
 const seen:URL[]=[];
 await page.route("**/api/**",async route=>{
  const u=new URL(route.request().url());seen.push(u);let data:unknown={};
  if(u.pathname.endsWith("/notifications/stream"))return route.fulfill({contentType:"text/event-stream",body:": fixture\n\n"});
  if(u.pathname==="/api/v1/spreadsheets")data=[{code:"journals",label:"Nhật ký",importEnabled:false,supportsDateFilter:true,scopeLabel:null,columns:[]},{code:"bank-statements",label:"Sao kê",importEnabled:true,supportsDateFilter:true,scopeLabel:null,columns:[]},{code:"category-budgets",label:"Hạn mức",importEnabled:true,supportsDateFilter:false,scopeLabel:"Dự án",columns:[]}];
  else if(u.pathname.endsWith("/scopes"))data=u.pathname.includes("category-budgets")?[{id:7,label:"PRJ-7 · Dự án"}]:[];
  else if(u.pathname.endsWith("/exports/history")){if(historyError)return route.fulfill({status:500,json:{success:false,message:"Không tải được lịch sử xuất."}});data=[];}
  else if(u.pathname.endsWith("/audit-history/export"))return route.fulfill({contentType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",body:Buffer.from("isolated-browser-download-fixture")});
  else if(u.pathname.endsWith("/admin/audit"))data={items:[],page:1,size:20,total:0,totalPages:0};
  else if(u.pathname.endsWith("/budget-exposure")){const n=Number(u.searchParams.get("page")||1);data={items:Array.from({length:n===1?20:1},(_,i)=>({projectId:(n-1)*20+i+1,projectCode:`PRJ-${(n-1)*20+i+1}`,projectName:`Dự án ${(n-1)*20+i+1}`,totalBudget:0,projectFundBalance:0,recognizedExpense:0,lockedForRequests:0,openAdvance:0,phases:[]})),total:21,page:n,size:20,totalPages:2};}
  else if(u.pathname.includes("/lookups/"))data={items:[{id:9,label:"EMP-9 · Nhân viên tham chiếu"}],total:1,page:1,size:20,totalPages:1};
  else if(u.pathname.endsWith("/journals")||u.pathname.endsWith("/wallet-transactions"))data={items:[],total:0,page:1,size:20,totalPages:0};
  else if(u.pathname.endsWith("/summary"))data={currentBalance:0,totalInflow:0,totalOutflow:0,transactionCount:0};
  else if(u.pathname.includes("unread"))data=0;
  return route.fulfill({json:{success:true,data}});
 });return seen;
}
test("Excel restores dataset dates scope and reload without erasing the deep link",async({page})=>{
 await setup(page);await page.goto("/data-exchange?dataset=bank-statements&from=2026-10-01&to=2026-10-20");
 await expect(page.getByRole("combobox",{name:/^Bộ dữ liệu/})).toHaveValue("bank-statements");await expect(page.getByLabel("Từ ngày theo bộ dữ liệu")).toHaveValue("2026-10-01");await expect(page.getByLabel("Đến ngày theo bộ dữ liệu")).toHaveValue("2026-10-20");
 await page.reload();await expect(page.getByRole("combobox",{name:/^Bộ dữ liệu/})).toHaveValue("bank-statements");
 await page.goto("/data-exchange?dataset=category-budgets&scope=7");await expect(page.getByRole("combobox",{name:/^Dự án/})).toHaveValue("7");await expect(page).toHaveURL(/scope=7/);
 await page.goBack();await expect(page.getByRole("combobox",{name:/^Bộ dữ liệu/})).toHaveValue("bank-statements");await expect(page.getByLabel("Từ ngày theo bộ dữ liệu")).toHaveValue("2026-10-01");
});
test("Export history failure is an error, never a fabricated empty result",async({page})=>{
 await setup(page,"ACCOUNTANT",true);await page.goto("/data-exchange?dataset=journals");await expect(page.getByRole("alert").filter({hasText:"Hệ thống đang gặp sự cố."})).toBeVisible();await expect(page.getByText("Chưa có file nào được xuất.")).toHaveCount(0);
});
test("Audit list and full XLSX export preserve the same filters",async({page})=>{
 const seen=await setup(page,"ADMIN");await page.goto("/admin/audit-logs?actor=An&action=UPDATE&startDate=2026-10-01&endDate=2026-10-20");
 await expect.poll(()=>seen.some(u=>u.pathname.endsWith("/admin/audit")&&u.searchParams.get("from")==="2026-10-01")).toBeTruthy();
 const download=page.waitForEvent("download");await page.getByRole("button",{name:"Xuất Excel theo bộ lọc"}).click();expect((await download).suggestedFilename()).toBe("ifms-audit-history.xlsx");
 const u=seen.find(u=>u.pathname.endsWith("/audit-history/export"))!;expect(u.searchParams.get("actor")).toBe("An");expect(u.searchParams.get("action")).toBe("UPDATE");expect(u.searchParams.get("to")).toBe("2026-10-20");expect(u.searchParams.has("page")).toBeFalsy();
});
test("Budget page requests server pages instead of downloading every project",async({page})=>{
 const seen=await setup(page);await page.goto("/accountant/ledger?tab=budget&page=1");await expect(page.getByText("PRJ-1",{exact:true})).toBeVisible();await page.getByRole("button",{name:"Sau",exact:true}).click();await expect(page.getByText("PRJ-21",{exact:true})).toBeVisible();await expect(page.getByText("PRJ-1",{exact:true})).toHaveCount(0);expect(seen.some(u=>u.pathname.endsWith("/budget-exposure")&&u.searchParams.get("page")==="2")).toBeTruthy();
});
test("Mobile journal picker selects a named reference and sends its ID",async({page})=>{
 await page.setViewportSize({width:390,height:844});const seen=await setup(page);await page.goto("/accountant/ledger?tab=journal");const input=page.getByRole("combobox",{name:"Nhân viên",exact:true});await input.fill("An");await page.getByRole("option",{name:"EMP-9 · Nhân viên tham chiếu"}).click();await expect.poll(()=>seen.some(u=>u.pathname.endsWith("/journals")&&u.searchParams.get("employeeId")==="9")).toBeTruthy();await expect(input).toHaveValue("EMP-9 · Nhân viên tham chiếu");
});
