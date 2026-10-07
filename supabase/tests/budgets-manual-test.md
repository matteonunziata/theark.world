# Budgets & Payments: manual test script

The database rules are tested by `supabase/tests/budgets.sql` (isolation, status rules, audit trail, files). This script is the same story through the screens.

**Setup (2 minutes).** Sector managers sign in with Google, so you need two real `@theark.world` accounts. In Settings → Team, edit two teammates (or two spare Workspace accounts):
- Person A: Division **TEST – Farm sector**, Finance role **Sector manager**.
- Person B: Division **TEST – Events sector**, Finance role **Sector manager**.
You stay admin. Put their divisions and Finance role back when you're done.

1. **As A (phone is fine):** Finance → Budgets → *New budget*. Name "Farm, this month", type **Monthly**, pick the month. It opens as a Draft.
2. *Add a line*: "Seeds", planned ₡100,000. Add a second, "Salaries": it should be refused.
3. *Send for approval*. The status becomes Pending approval and the line can't be edited.
4. *New budget* again: name "Greenhouse", type **Project**, start and end dates. Add a line "Build", ₡1,000,000, and send it for approval.
5. **As you (admin):** Finance → **Approvals**. Both budgets are listed. Approve "Farm, this month". Reject "Greenhouse" with no comment: it asks for one. Reject it with a comment.
6. **As A:** "Greenhouse" is Rejected with your comment. *Reopen as draft*, send it again.
7. **As you:** approve "Greenhouse".
8. **As A, Monthly budget:** *Log an expense*: Seeds, ₡30,000, description, attach a photo. Try without a photo: refused. Log a second one for ₡90,000: it saves, with a warning that Seeds is over plan. The line's bar turns red.
9. **As A, Project budget:** Providers → *Add a provider* "Constructora Pura Vida" with a bank account. Back on "Greenhouse": *Request a payment* for ₡400,000, milestone "Foundations", due date.
10. **As you:** Approvals → Payments to make: the request shows the bank account. *Mark paid* without a receipt: refused. Upload a payment receipt and mark it paid.
11. **As A:** Payments made shows the payment, and you can download the receipt. Open the budget's History: every step has a name and a time.
12. **As B:** Budgets is empty (A's budgets are not visible, not even by pasting A's budget URL, which gives "not found"). Providers shows the company but **no bank account**. Payments made is empty. Create your own budget to confirm B can work in B's sector.
13. **As you:** Finance → Overview → "Budgets by sector" rolls up planned vs spent per sector. Flip the ₡/$ toggle: everything converts.
14. *Leave feedback* (button in the header) from A; read it under Finance → Feedback.

Clean up: delete the two test budgets' drafts if you like, and remove the TEST divisions/team rows when finished (Settings → Divisions / Team).
