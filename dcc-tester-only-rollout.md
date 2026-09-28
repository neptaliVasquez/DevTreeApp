# Testing Dataset Contracts & Controls safely in a shared environment

*Status as of 2026-09-28*

## In one paragraph

We are testing a new feature, **Dataset Contracts & Controls (DCC)**, in an environment that other people also use every day. Only the test team should ever see or be affected by it. We achieve this with **two lists**, one of **testers** and one of **test workspaces**, that switch the feature on only where both apply. Everyone else keeps using the platform exactly as before. If anything is set up wrongly, the result is that **nobody** gets the new feature, never that everybody does.

## Key terms

| Term | Meaning |
|---|---|
| **DCC** | The new feature. A dataset owner can require users to accept one or more agreements before using the data, and can require an independent reviewer to approve any file taken out of the workspace. |
| **Agreement (DUA)** | A Data Use Agreement. With DCC, users see a pop-up asking them to accept it when they open a workspace that uses the dataset. |
| **Workspace** | A private project area where users work with approved data. Only invited members can see or enter it. |
| **Airlock request** | A request to take files out of a workspace. Normally the workspace owner approves it. With DCC, an independent reviewer must approve it too. |
| **Access request** | A user's request to use a dataset, including which workspace it should go to. The dataset owner approves or declines it. |
| **Feature flag** | An on/off switch managed in the Azure Portal. It can be limited to a list of people or workspaces, and changes take effect in about 30 seconds with no software release. |

## When does someone experience DCC?

Users only notice DCC **inside a workspace**, in three ways:

1. an **agreement pop-up** when they open the workspace
2. an **extra reviewer** approving their airlock requests
3. **reviewer accounts** being created and invited to the workspace

All three are switched on by one single moment: **when an access request for a DCC dataset is approved**, the dataset's DCC settings are connected to the workspace chosen in that request. If that connection never happens, the workspace behaves normally, and the user sees none of the three.

That moment is where our main safeguard sits.

## The safeguards

We use two lists (feature flags):

- **Testers:** the email addresses of the test team
- **Test workspaces:** the IDs of the workspaces created for testing

They are applied at three points:

| Point | What happens for people who are not testers |
|---|---|
| **Setting up DCC on a dataset** | They don't see the DCC options, and the system ignores any attempt to set them. |
| **Viewing a dataset's page** | They don't see the dataset's DCC information. |
| **Approving an access request** (the key moment) | DCC is connected to the workspace **only if the person who asked for access is a tester AND the chosen workspace is a test workspace**. In every other case, access is granted normally, without DCC. |

## What happens in practice

| Situation | Result |
|---|---|
| A non-tester requests access to a DCC test dataset for their own workspace | They get normal access. No pop-up, no extra reviewer. |
| A tester requests a DCC dataset for a normal (non-test) workspace | That workspace is not affected. |
| A tester requests a DCC dataset for a test workspace | The full DCC experience, as intended for testing. |
| Anyone else using workspaces without DCC datasets | Nothing changes. |
| A list is missing, switched off or set up wrongly | Nobody gets DCC. |

## Why we are confident this is safe

1. **There is only one way in.** DCC can only reach a workspace at the moment an access request is approved. We checked the code of every system involved, and there is no other path.
2. **Mistakes switch DCC off, not on.** A missing, disabled or misconfigured list is treated as "not allowed".
3. **Two conditions must both be true.** A person being on the tester list is not enough on its own, and neither is a workspace being on the workspace list.
4. **The check is about the right people.** It looks at who asked for access and which workspace they chose, not at who clicks "approve". This is covered by automated tests.
5. **Test workspaces are private.** A newly created workspace has only its creator as a member. Nobody else can see or enter it unless the owner invites them.
6. **Easy to undo.** Adding or removing people or workspaces, switching DCC off, or releasing it to everyone is done in the Azure Portal, with no software release.

## Rules for the test team

To keep the test fully contained:

1. **Keep test workspaces for testers only.** Agreements apply to everyone in a workspace, so a non-tester who is invited into a test workspace would also see the pop-up.
2. **Use testers' emails as airlock reviewers.** The reviewers set on a DCC dataset are automatically added to the workspace when access is approved.
3. **Set up in this order:**
   1. create the test workspace in the Workspaces app
   2. add its ID (shown in the workspace's web address) to the test workspaces list
   3. request the DCC dataset and choose that **existing** workspace

   Do **not** use the "new workspace" option inside the access request. That workspace has no ID yet when the request is approved, so DCC would not be connected to it.
4. **Decline requests from non-testers** for DCC test datasets. They would get normal access to the data, just without DCC.

## Known limitations

| Limitation | How we handle it |
|---|---|
| Workspaces that received DCC **before these safeguards are released** keep it. | Review existing test data and clean up where needed. |
| Platform administrators may be able to see any workspace. | Accepted. Administrators are part of the platform team. |
| Non-testers can see that a DCC test dataset exists, and could be given normal access to it. | Testers decline such requests (rule 4). |
| Access approved while a person or workspace was not on the lists does **not** gain DCC later, when the feature is opened up. | To be planned as part of the go-live. |
| Emails and workspace IDs must match exactly, including capital letters. | If a tester doesn't see DCC, check their list entry first. |

## Day-to-day operation

All done in the Azure Portal (App Configuration → `catalogdev-cfg` → Feature flags):

| Task | What to do |
|---|---|
| Add a tester | Add their sign-in email to the flag **`Ui.Dcc.Authoring`** |
| Add a test workspace | Add the workspace ID to the flag **`Dcc.Workspaces`**, before requesting data into it |
| Remove a tester or workspace | Remove their entry from the list |
| Switch DCC off completely | Switch off both flags |
| Release DCC to everyone | Set both flags to 100% |
| After the full release | The development team removes the flags and the related checks |

## Status and next steps

- **Done:** only testers can set up DCC on datasets. This is live in the kaho test environment.
- **Built and tested, not yet released:** the workspace safeguard, and hiding DCC on dataset pages.
- **Next steps:**
  1. release the workspace safeguard to the kaho test environment
  2. create the test workspaces list with the test workspace IDs
  3. confirm end to end that non-testers see no DCC
  4. review existing test data for workspaces that already have DCC
