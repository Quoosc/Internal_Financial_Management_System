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

test("Changing cost project clears its evidence confirmation, reason and PIN",async({page})=>{
 await setup(page);
 await page.route("**/api/v1/spreadsheets/lookups/project?*",r=>{const id=new URL(r.request().url()).searchParams.get("id");return r.fulfill({json:{success:true,data:{items:id?[{id:Number(id),label:`PRJ-${id}`}]:[{id:1,label:"PRJ-1"},{id:2,label:"PRJ-2"}],totalPages:1}}});});
 await page.route("**/api/v1/accountant/ledger/cost-reconciliation/*",r=>{const id=Number(r.request().url().split("/").pop());return r.fulfill({json:{success:true,data:{projectId:id,current:{projectCost:100,phaseCosts:{},categoryCosts:{},scopeLabels:{}},verifiedCost:50,journalCost:50,sourceCount:1,phaseCosts:{},categoryCosts:{},errors:[],eligible:true}}});});
 await page.goto("/accountant/ledger/cost-reconciliation");const picker=page.getByRole("combobox",{name:"Dự án",exact:true});await picker.click();await page.getByRole("option",{name:"PRJ-1",exact:true}).click();
 const reason=page.getByPlaceholder("Lý do điều chỉnh và mã biên bản đối chiếu"),pin=page.getByPlaceholder("PIN giao dịch");await reason.fill("Reviewed first project evidence");await pin.fill("12345");await page.getByRole("checkbox").check();await expect(page.getByRole("button",{name:"Cập nhật bộ đếm có biên bản"})).toBeEnabled();
 await picker.click();await page.getByRole("option",{name:"PRJ-2",exact:true}).click();await expect(reason).toHaveValue("");await expect(pin).toHaveValue("");await expect(page.getByRole("checkbox")).not.toBeChecked();await expect(page.getByRole("button",{name:"Cập nhật bộ đếm có biên bản"})).toBeDisabled();
});
for(const path of ["journals/999","999"]){test(`Detail ${path} distinguishes HTTP 500 from missing data and retries`,async({page})=>{
 await setup(page);let count=0;await page.route(`**/api/v1/accountant/ledger/${path}`,r=>{count++;return r.fulfill({status:count===1?500:404,json:{success:false,message:count===1?"Service unavailable":"Missing record"}});});
 await page.goto(`/accountant/ledger/${path}`);await expect(page.getByRole("alert")).toBeVisible();await expect(page.getByText(path.startsWith("journals")?"Không tìm thấy bút toán.":"Không tìm thấy giao dịch.",{exact:true})).toHaveCount(0);
 await page.getByRole("button",{name:"Thử lại",exact:true}).click();await expect(page.getByRole("alert").filter({has:page.getByRole("button",{name:"Thử lại",exact:true})})).toContainText(path.startsWith("journals")?"Không tìm thấy bút toán.":"Không tìm thấy giao dịch.");expect(count).toBe(2);
});}
test("Bank API failure shows retry without fake configuration or empty statements",async({page})=>{
 await setup(page);let count=0;await page.route("**/api/v1/company-fund",r=>{count++;return r.fulfill({status:500,json:{success:false,message:"Service unavailable"}});});await page.goto("/accountant/ledger/reconciliation");await expect(page.getByRole("alert")).toBeVisible();await expect(page.getByRole("heading",{name:"Xác nhận phạm vi tài khoản"})).toHaveCount(0);await expect(page.getByText("Chưa có dòng sao kê trong khoảng đã chọn.")).toHaveCount(0);await page.getByRole("button",{name:"Thử lại",exact:true}).click();await expect.poll(()=>count).toBe(2);
});
test("Dimension filtered ledger does not label partial journal lines unbalanced",async({page})=>{
 await setup(page);await page.route("**/api/v1/accountant/ledger/accounts?*",r=>r.fulfill({json:{success:true,data:{from:"2026-10-01",to:"2026-10-23",generatedAt:"2026-10-23T00:00:00Z",accounts:[],balanced:false,entries:{items:[],total:0,totalPages:0}}}}));await page.goto("/accountant/ledger/accounts?projectId=9");await expect(page.getByText("Tổng phát sinh trong phạm vi lọc; xem bút toán đầy đủ để kiểm tra cân bằng")).toBeVisible();await expect(page.getByText("Tổng hai phía chưa cân bằng",{exact:true})).toHaveCount(0);
});
test("Bank matching picker pages and searches on the server",async({page})=>{
 await setup(page);const seen:URL[]=[];
 await page.route("**/api/v1/company-fund",r=>r.fulfill({json:{success:true,data:{bankAccount:"TEST",bankScopeConfirmed:true}}}));await page.route("**/api/v1/company-fund/reconciliation",r=>r.fulfill({json:{success:true,data:{}}}));
 await page.route("**/api/v1/accountant/ledger/bank-evidence?*",r=>r.fulfill({json:{success:true,data:[{id:1,bankReference:"BANK-1",amount:10,bookingDate:"2026-10-01",direction:"IN",state:"BOOKED",transactionId:null}]}}));
 await page.route("**/api/v1/accountant/ledger/bank-evidence/1/candidates?*",r=>{const u=new URL(r.request().url());seen.push(u);const second=u.searchParams.get("page")==="2";return r.fulfill({json:{success:true,data:{items:[{id:second?21:1,label:second?"TXN-21":"TXN-1"}],total:21,totalPages:2}}});});
 await page.goto("/accountant/ledger/reconciliation");await page.getByRole("button",{name:"Đối chiếu",exact:true}).click();await expect(page.getByRole("option",{name:"TXN-1",exact:true})).toBeVisible();await page.getByRole("button",{name:"Sau",exact:true}).click();await expect(page.getByRole("option",{name:"TXN-21",exact:true})).toBeVisible();await page.getByRole("option",{name:"TXN-21",exact:true}).click();await page.getByLabel("Tìm mã chứng từ hoặc giao dịch").fill("old-code");await page.getByLabel("Từ ngày ứng viên").fill("2020-01-01");await expect.poll(()=>seen.some(u=>u.searchParams.get("search")==="old-code"&&u.searchParams.get("from")==="2020-01-01"&&u.searchParams.get("page")==="1")).toBeTruthy();await expect(page.getByText("Đã chọn: TXN-21")).toBeVisible();
});

test("Topup evidence picker finds old documents by code date and amount",async({page})=>{
 await setup(page);const seen:URL[]=[];await page.route("**/api/v1/company-fund",r=>r.fulfill({json:{success:true,data:{bankAccount:"TEST",bankScopeConfirmed:true}}}));await page.route("**/api/v1/company-fund/reconciliation",r=>r.fulfill({json:{success:true,data:{}}}));
 await page.route("**/api/v1/accountant/ledger/bank-evidence/topup-candidates?*",r=>{const u=new URL(r.request().url());seen.push(u);return r.fulfill({json:{success:true,data:{items:[{id:501,label:"BANK-OLD · 777 đ · 2020-01-02"}],total:501,totalPages:26}}});});
 await page.goto("/accountant/system-fund");await page.getByRole("button",{name:"Nạp tiền từ ngân hàng",exact:true}).click();await page.getByLabel("Tìm mã chứng từ hoặc giao dịch").fill("BANK-OLD");await page.getByLabel("Từ ngày ứng viên").fill("2020-01-01");await page.getByLabel("Lọc đúng số tiền chứng từ").fill("777");await expect.poll(()=>seen.some(u=>u.searchParams.get("search")==="BANK-OLD"&&u.searchParams.get("from")==="2020-01-01"&&u.searchParams.get("amount")==="777")).toBeTruthy();await page.getByRole("option",{name:"BANK-OLD · 777 đ · 2020-01-02"}).click();await expect(page.getByText("Đã chọn: BANK-OLD · 777 đ · 2020-01-02")).toBeVisible();
});
