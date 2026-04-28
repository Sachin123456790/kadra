Fund formation & governance → Documents page → Governing tab (master LPA flow, Demo step 2)                                                      
  
- NGEIF_I_Executed_LPA_20260201_v1.0.pdf — Master LPA. Uploaded first; SHA-256 hashed and anchored on-chain via DocumentRegistry. Source of truth
  for fund terms, waterfall, transfer rules.            
- NGEIF_I_GP_Organizational_Consent_20260201_v1.0.pdf — GP entity formation consent. Stored alongside LPA as governing doc.                      
- NGEIF_I_Fund_Wire_Instructions_20260201_v1.0.pdf — Fund's bank wire details. Referenced by every capital call.                                 
- Angainor Demo Fund Structure (1).pdf — Reference deck for fund structure (LP/GP/Holdcos).                                                      
- Angainor Demo Documents (Inputs) List.pdf — Index/manifest of this whole folder.                                                               
- Angainor Demo Fund Calculations V2 (5).pdf — Reference math (waterfall/IRR worked examples).                                                   
                                                                                                                                                  
Per-LP onboarding → Investors page (KYC/admission, linked to each investor record)                                                               
                                                                                                                                                  
For each investor (HAR, JHT, MER, RED, SUM, WES):                                                                                                
- ..._Subscription_Agreement_<LP>_..._Executed.pdf — LP commits capital. Drives subscription row.
- ..._GP_Admission_Consent_<LP>_...pdf — GP signs admitting them.                                                                                
- ..._Side_Letter_<LP>_..._Executed.pdf — Per-LP negotiated terms (fee discounts, MFN, etc.).
- ..._Subscription_Amendment_WES_20260520_...pdf (+ GP consent) — Westbridge increased commitment mid-flight; example of amendment flow.         
                                                                                                                                                  
Capital Call 001 → Settlement page (Demo step 4)                                                                                                 
                                                                                                                                                  
- NGEIF_I_Capital_Call_Notice_Call_001_20260722_v1.0.pdf — The notice the GP sends LPs. Generated today via the new pdfmake/markdown pipeline.   
- NGEIF_I_Capital_Call_Schedule_Call_001_20260722_v1.0.xlsx — Per-LP amounts for the call.
- NGEIF_I_Capital_Call_Wire_Instructions_Call_001_20260722_v1_0.pdf — Attached to call notice.                                                   
- NGEIF_I_GP_Approval_for_Capital_Call_001_20260722_v1.0.pdf — Internal GP authorization.                                                        
- NGEIF_I_Bank_Receipt_Confirmation_Call_001_20260805_v1.0.pdf — Wire receipt uploaded by admin. Drives 3-way match → state Pending→Settled →    
token mint.                                                                                                                                      
- NGEIF_I_Remittance_Advice_WES_Call_001_20260805_v1.0.pdf — Bank-side remittance, tied to settlement record.                                    
- NGEIF_I_Capital_Call_Cure_Notice_Westbridge_..._Call_001.pdf — Cure notice (LP missed deadline).                                               
- NGEIF_I_Settlement_Exception_Memo_Westbridge_..._Call.pdf — Exception trail for the cured wire.                                                
                                                                                                                                                  
Transfers (LP-to-LP) → Transfers page (Demo steps 7-8)                                                                                           
                                                                                                                                                  
- NGEIF_I_Assignment_and_Assumption_James_Holloway_..._to_Cedar_Peak_...pdf (JHT→CED, 2026-09-30)                                                
- NGEIF_I_GP_Consent_to_Transfer_James_Holloway_..._to_Cedar_Peak_...pdf
- NGEIF_I_Joinder_Agreement_Cedar_Peak_Secondary_Partners_20260930.pdf — Cedar Peak joins as new LP.                                             
- NGEIF_I_Assignment_and_Assumption_Cedar_Peak_to_Pine_Ridge_20261115.pdf (CED→PIN)                                                              
- NGEIF_I_GP_Consent_to_Transfer_Cedar_Peak_to_Pine_Ridge_20261115.pdf                                                                           
- NGEIF_I_Joinder_Agreement_Pine_Ridge_Secondary_Partners_20261115.pdf                                                                           
                                                                                                                                                  
Distribution 001 → Distribution page (Demo step 6 / waterfall)                                                                                   
                                                                                                                                                  
- NGEIF_I_GP_Approval_for_Distribution_001_20270215_v1.0.pdf — GP authorization.                                                                 
- NGEIF_I_Distribution_Allocation_Schedule_001_20270215_v1.0.xlsx — Per-LP waterfall output.
- NGEIF_I_Distribution_Notice_001_20270215_v1.0.pdf — Notice sent to each LP. Generated through the same notice pipeline.                        
                                                                                                                                                  
Year-end financials & NAV → Audit & Exports page (Demo step 9, reporting docs)                                                                   
                                                                                                                                                  
- NGEIF_I_Year_End_NAV_Package_20261231_v1.0.xlsx — NAV roll-forward.                                                                            
- NGEIF_I_Valuation_Committee_Memo_20261231_v1.0.pdf — VC sign-off backing the NAV.
- NGEIF_I_Trial_Balance_20261231_v1.0.xlsx — Accounting TB.                                                                                      
- NGEIF_I_Fund_Bank_Statement_20261231_v1.0.pdf — Fund cash position.                                                                            
- NGEIF_I_Debt_Balance_Statement_20261231_v1.0.pdf — Holdco debt.                                                                                
- NGEIF_I_Appraisal_Report_Holdco_A_20261231_v1.0.pdf, ..._Holdco_B_...pdf — Property appraisals supporting NAV.     