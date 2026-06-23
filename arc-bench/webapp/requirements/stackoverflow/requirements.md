# Stack Overflow Platform
Web-based question and answer platform for developers, completing the construction of front-end and back-end infrastructure for community-driven knowledge sharing.

## ROOT.1 Enter Platform
Normal Flow: Enter Platform

**Dependencies:** None

**Scenarios:**
- Enter Platform
  - **GIVEN:** User is in a web browser.
  - **WHEN:** Open the Stack Overflow platform root URL (/)
  - **THEN:** Display the homepage with header, sidebar navigation, and main question feed

## REQ-1 Homepage
![image](./reference/homepage.jpeg) The central hub of the platform, providing access to all core features. **Entry Points:** - Access via root URL (/). - Click the platform logo in the Global Navigation Header (REQ-1-1). It coordinates the global layout including navigation, content discovery, and community updates.

**Dependencies:** None

### REQ-1.1 View Homepage Total Layout
Normal Flow: View Homepage Layout

**Dependencies:** ROOT.1

**Scenarios:**
- View Homepage Total Layout
  - **GIVEN:** User is on the homepage.
  - **WHEN:** View the page layout
  - **THEN:** Display the multi-column homepage layout including header, sidebar, and main feed.

### REQ-1-1 Global Navigation Header
Fixed top bar for global navigation and utility. Includes the platform logo, search input with suggestions, product links, and authentication status (Login/Sign up buttons or User Avatar/Stats).

**Dependencies:** None

**Scenarios:**
- Global Navigation Header
  - **GIVEN:** User can see the global navigation header.
  - **WHEN:** View top bar
  - **THEN:** Logo, search bar, and user profile/auth links are visible and properly aligned.

### REQ-1-2 Sidebar Navigation
Left-hand navigation menu providing vertical access to major modules: Home, Questions, Tags, Users.

**Dependencies:** None

**Scenarios:**
- Sidebar Navigation
  - **GIVEN:** User can see the left sidebar navigation.
  - **WHEN:** Click on navigation items
  - **THEN:** Highlight active section and navigate to corresponding page without full reload if applicable.

### REQ-1-3 Main Question Feed
The core content area displaying a list of recent or trending questions. Includes the "Ask Question" action, list filtering/sorting tabs (Newest, Active, etc.), and individual question summaries with engagement metrics (votes, answers, views).

**Dependencies:** None

**Scenarios:**
- Main Question Feed
  - **GIVEN:** User can see the main question feed.
  - **WHEN:** Scroll through the central feed
  - **THEN:** Display questions with titles, tags, and summary stats consistent with the design.

### REQ-1-4 Right Sidebar Widgets
Auxiliary information panel on the right side. Contains "The Overflow Blog", "meta items", "Hot Network Questions", and custom filters/tag watchlists.

**Dependencies:** None

**Scenarios:**
- Right Sidebar Widgets
  - **GIVEN:** User can see the right sidebar area on the homepage.
  - **WHEN:** Check right-side content
  - **THEN:** Display featured blog posts and community-wide trending questions.

## REQ-2 User Authentication Module
Handles all aspects of user identity, including account creation, authentication via credentials, and session management. This module  serves as the gatekeeper for authenticated features.  (Note: Social/SSO login is excluded from the current scope per design instructions).

**Dependencies:** REQ-1

### REQ-2.1 Anonymous Session
Normal Flow: Anonymous Session

**Dependencies:** ROOT.1

**Scenarios:**
- Anonymous Session
  - **GIVEN:** User is not logged in.
  - **WHEN:** View the global navigation header
  - **THEN:** Show "Log in" and "Sign up" entry points

### REQ-2.2 Authenticated Session
Normal Flow: Authenticated Session

**Dependencies:** None

**Scenarios:**
- Authenticated Session
  - **GIVEN:** User is logged in.
  - **WHEN:** View the global navigation header
  - **THEN:** Show user avatar/profile entry and authenticated navigation options

### REQ-2.3 Elevated Privileges
Normal Flow: Elevated Privileges

**Dependencies:** None

**Scenarios:**
- Elevated Privileges
  - **GIVEN:** User has elevated privileges (e.g., moderator or profile owner).
  - **WHEN:** Access privilege-gated pages or sections
  - **THEN:** Restricted information and actions are available

### REQ-2-1 User Login
Traditional email and password login interface.  ![image](./reference/login.jpeg) Components: Stack Overflow Logo, Email Input, Password Input (with toggle/visibility and "Forgot password?" link), "Log in" submit button, and "Sign up" redirect link.

**Dependencies:** None

#### REQ-2-1.1 Happy Path - Successful Login
Normal Flow: Successful Login

**Dependencies:** REQ-1.1

**Scenarios:**
- Happy Path - Successful Login (1)
  - **GIVEN:** User is on the homepage and is not logged in.
  - **WHEN:** Click "Log in" in the navigation bar
  - **THEN:** Display login form with email/password fields
- Happy Path - Successful Login (2)
  - **GIVEN:** Login form is visible.
  - **WHEN:** Enter registered email and correct password, click "Log in"
  - **THEN:** Authenticate user and redirect to homepage with logged-in status

#### REQ-2-1.2 Error - Empty Credentials
Exception Flow: Empty Credentials

**Dependencies:** REQ-1.1

**Scenarios:**
- Error - Empty Credentials
  - **GIVEN:** Login form is visible.
  - **WHEN:** Click "Log in", leave email and password empty, click "Log in" button
  - **THEN:** Display validation errors "Email cannot be empty" and "Password cannot be empty"

#### REQ-2-1.3 Error - Invalid Email Format
Exception Flow: Invalid Email Format

**Dependencies:** REQ-1.1

**Scenarios:**
- Error - Invalid Email Format
  - **GIVEN:** Login form is visible.
  - **WHEN:** Enter "invalid-email-format", click "Log in"
  - **THEN:** Show error message "The email is not a valid email address"

#### REQ-2-1.4 Error - Unregistered Email
Exception Flow: Unregistered Email

**Dependencies:** REQ-1.1

**Scenarios:**
- Error - Unregistered Email
  - **GIVEN:** Login form is visible.
  - **WHEN:** Enter an email not in the database, click "Log in"
  - **THEN:** Show error message "No account found with this email"

#### REQ-2-1.5 Error - Incorrect Password
Exception Flow: Incorrect Password

**Dependencies:** REQ-1.1

**Scenarios:**
- Error - Incorrect Password
  - **GIVEN:** Login form is visible.
  - **WHEN:** Enter valid email but wrong password, click "Log in"
  - **THEN:** Show error message "The email or password does not match any account"

### REQ-2-2 User Registration
Allows new users to create an account using email and password. ![image](./reference/sign-up.jpeg) Components: "Join Stack Overflow" header, Email Input, Password Input, Help text for password complexity, "Sign up" button, TOS/Privacy consent text, and "Log in" redirect link.

**Dependencies:** None

#### REQ-2-2.1 Happy Path - Successful Sign up
Normal Flow: Successful Sign Up

**Dependencies:** REQ-1.1

**Scenarios:**
- Happy Path - Successful Sign up (1)
  - **GIVEN:** User is on the homepage or login page and is not logged in.
  - **WHEN:** Click "Sign up" in the navigation bar or "Sign up" link on login page
  - **THEN:** Display registration modal/page
- Happy Path - Successful Sign up (2)
  - **GIVEN:** Registration form is visible.
  - **WHEN:** Enter a unique email and valid password, click "Sign up"
  - **THEN:** Create user record, automatically log in, and redirect to homepage

#### REQ-2-2.2 Error - Email Already Registered
Exception Flow: Email Already Registered

**Dependencies:** REQ-1.1

**Scenarios:**
- Error - Email Already Registered
  - **GIVEN:** Registration form is visible.
  - **WHEN:** Enter an already registered email address, click "Sign up"
  - **THEN:** Show error "Email is already in use"

#### REQ-2-2.3 Error - Weak Password
Exception Flow: Weak Password

**Dependencies:** REQ-1.1

**Scenarios:**
- Error - Weak Password
  - **GIVEN:** Registration form is visible.
  - **WHEN:** Enter email and a password that doesn't meet safety criteria (e.g. too short)
  - **THEN:** Show validation error explaining password requirements (e.g. minimum 8 characters)

### REQ-2-3 View User Profile
Displays a comprehensive summary of a user's activity, reputation, and achievements. ![image](./reference/profile-page.jpeg)

**Dependencies:** REQ-2, REQ-2-1.1

**Scenarios:**
- View User Profile
  - **GIVEN:** User is logged in and can see the avatar or username in the header.
  - **WHEN:** Click user avatar or username in the top navigation bar header.
  - **THEN:** Redirect to the profile page, defaulting to the Activity -> Summary view  showing user stats and recent activity modules.

### REQ-2-4 Edit Profile Management
Allows users to customize their public identity and manage private details. ![image](./reference/edit-profile.jpeg)

**Dependencies:** REQ-2-3

**Scenarios:**
- Edit Profile Management (1)
  - **GIVEN:** User is on their profile page.
  - **WHEN:** Click "Edit profile" button on the profile page
  - **THEN:** Display the "Edit your profile" form with all current information pre-filled.
- Edit Profile Management (2)
  - **GIVEN:** The 'Edit your profile' form is visible.
  - **WHEN:** Modify Display name, Location, Title or "About me" (using Markdown editor)
  - **THEN:** Input fields reflect changes; editor provides real-time preview if applicable.
  - **WHEN:** Update social links (Website, X, GitHub) and Full name
  - **THEN:** Data validation for URL formats and length.
  - **WHEN:** Click "Save and copy changes to all public communities"
  - **THEN:** Profile is updated across the platform and a success message is displayed.

## REQ-3 Question Module
Core functionality for posting, viewing, editing, and managing questions. Questions include title, body, tags, vote count, view count, and answer count. ![image](./reference/questions-page.jpeg)

**Dependencies:** REQ-2

### REQ-3.1 View Question List
Normal Flow: View Question List

**Dependencies:** REQ-1.1

**Scenarios:**
- View Question List
  - **GIVEN:** User is on the homepage and can see the sidebar navigation.
  - **WHEN:** Navigate to Questions tab
  - **THEN:** Display paginated list of questions with metadata (votes, answers, views, tags)

### REQ-3-1 Ask Question
Authenticated users can post new questions with title, body (markdown/rich text editor), and tags. ![image](./reference/ask-question-page.jpeg)

**Dependencies:** REQ-2

#### REQ-3-1.1 Create New Question
Normal Flow: Create New Question

**Dependencies:** REQ-2.2

**Scenarios:**
- Create New Question (1)
  - **GIVEN:** User is logged in.
  - **WHEN:** Click "Ask Question" button in navigation or homepage
  - **THEN:** Display question creation form
- Create New Question (2)
  - **GIVEN:** Question creation form is visible.
  - **WHEN:** Enter question title (minimum 15 characters)
  - **THEN:** Validate title length and show character count
  - **WHEN:** Enter question body using markdown editor (minimum 220 characters)
  - **THEN:** Display live markdown preview
  - **WHEN:** Add up to 5 relevant tags
  - **THEN:** Show tag suggestions based on input, validate tag count
  - **WHEN:** Click "Post Your Question"
  - **THEN:** Create question, redirect to question detail page, and show question in profile page under "Questions" tab

#### REQ-3-1.2 Validation for Required Fields
Exception Flow: Required Field Validation

**Dependencies:** REQ-2.2

**Scenarios:**
- Validation for Required Fields (1)
  - **GIVEN:** User is logged in.
  - **WHEN:** Click "Ask Question" button
  - **THEN:** Display question creation form
- Validation for Required Fields (2)
  - **GIVEN:** Question creation form is visible.
  - **WHEN:** Leave title field empty and click "Post Your Question"
  - **THEN:** Show error message "Title is required (minimum 15 characters)", prevent submission
  - **WHEN:** Enter title but leave body empty and click "Post Your Question"
  - **THEN:** Show error message "Question body is required (minimum 220 characters)", prevent submission
  - **WHEN:** Enter title and body but add no tags and click "Post Your Question"
  - **THEN:** Show error message "Please add at least one tag", prevent submission

### REQ-3-2 Question Detail Page
A multi-faceted page that serves as the primary view for a specific question, its answers, and associated community interactions. ![image](./reference/question-page.jpeg)

**Dependencies:** REQ-3

#### REQ-3-2.1 Default Question View
Normal Flow: Default Question View

**Dependencies:** REQ-3.1

**Scenarios:**
- Default Question View
  - **GIVEN:** A target question exists.
  - **WHEN:** Navigate to a specific question detail page
  - **THEN:** Display the full hierarchical layout including header, sidebar, body, and interaction sections.

#### REQ-3-2-1 Question Header and Metadata
Displays the question title prominently at the top, followed by metadata rows including "Asked" (date), "Modified" (last activity), and "Viewed" (count). Includes the "Ask Question" primary action button.

**Dependencies:** REQ-3-2.1

**Scenarios:**
- Question Header and Metadata
  - **GIVEN:** User is on a question detail page.
  - **WHEN:** Look at the top section of the page
  - **THEN:** Title is clear; metadata shows accurate timestamps and view counts.

#### REQ-3-2-2 Post Voting and Interaction Sidebar
A vertical sidebar to the left of the question body. Contains upvote/downvote arrows, the current score, a bookmark/favorite icon, and a timeline/history icon.

**Dependencies:** REQ-2.2, REQ-3-2.1

**Scenarios:**
- Post Voting and Interaction Sidebar
  - **GIVEN:** User is on a question detail page.
  - **WHEN:** View the left margin of the question
  - **THEN:** Voting arrows and score are visible. Bookmark icon reflects saved status.

#### REQ-3-2-3 Main Post Content and Tags
The primary area for the question's body text (rendered Markdown). Followed by a list of associated tags (clickable buttons) and a menu of post actions (Share, Edit, Follow).

**Dependencies:** REQ-3-2.1

**Scenarios:**
- Main Post Content and Tags
  - **GIVEN:** User is on a question detail page.
  - **WHEN:** Read the central content area
  - **THEN:** Body is formatted correctly; tags are displayed as distinct, navigable links.

#### REQ-3-2-4 Post Author and Ownership Card
A floating card at the bottom right of the question body showing the author's avatar, username, reputation, and badges. Displays the original posting timestamp.

**Dependencies:** REQ-3-2.1

**Scenarios:**
- Post Author and Ownership Card
  - **GIVEN:** User is on a question detail page.
  - **WHEN:** Scroll to the bottom of the question body
  - **THEN:** Author's information is clearly attributed with current site stats.

#### REQ-3-2-5 Question Comments and Inline Interaction
A list of threaded comments located directly below the question and its tags. Includes functionality to "Add a comment" and expand hidden comments.

**Dependencies:** REQ-3-2.1

**Scenarios:**
- Question Comments and Inline Interaction
  - **GIVEN:** User is on a question detail page.
  - **WHEN:** Look below the post-action menu
  - **THEN:** Comments are listed chronologically; "Add a comment" link is present for authenticated users.

### REQ-3-3 Edit Question
Allows authors and high-reputation users to refine questions. The edit interface mimics the Ask Question structure but includes revision history and modification tracking. ![image](./reference/edit-question.jpeg)

**Dependencies:** REQ-3-2

#### REQ-3-3.1 Enter Edit Mode
Normal Flow: Enter Edit Mode

**Dependencies:** REQ-3-2.1

**Scenarios:**
- Enter Edit Mode
  - **GIVEN:** User is on a question detail page and has permission to edit.
  - **WHEN:** Click "Edit" link below a question
  - **THEN:** Display the Edit Question page with all current content pre-populated in the respective fields.

#### REQ-3-3-1 Title and Tags Editor
Section for modifying the question's headline and categorization.

**Dependencies:** REQ-3-3.1

**Scenarios:**
- Title and Tags Editor
  - **GIVEN:** User is on the Edit Question page.
  - **WHEN:** Change text in "Title" field and update "Tags"
  - **THEN:** Input fields reflect the new content.

#### REQ-3-3-2 Markdown Body Editor with Preview
The main rich-text workspace. Includes a toolbar for Markdown formatting (Bold, Italic, Code, etc.) and a real-time preview rendered below the editor.

**Dependencies:** REQ-3-3.1

**Scenarios:**
- Markdown Body Editor with Preview
  - **GIVEN:** User is on the Edit Question page.
  - **WHEN:** Modify Markdown text in the "Body" textarea using the toolbar
  - **THEN:** The preview area below automatically updates to show the rendered HTML.

#### REQ-3-3-3 Edit Summary and Revision History
Components for documenting and viewing changes. Includes a "Rev" dropdown to view previous versions and an "Edit Summary" field to describe the reason for the update.

**Dependencies:** REQ-3-3.1

**Scenarios:**
- Edit Summary and Revision History
  - **GIVEN:** User is on the Edit Question page.
  - **WHEN:** Enter "Fixed a typo in the second paragraph" into the Edit Summary field
  - **THEN:** The summary is captured for the revision history.

#### REQ-3-3-4 Guidance Sidebar (How to Edit)
A supplemental widget on the right providing community guidelines on how to effectively edit posts.

**Dependencies:** REQ-3-3.1

**Scenarios:**
- Guidance Sidebar (How to Edit)
  - **GIVEN:** User is on the Edit Question page.
  - **WHEN:** Scan the "How to Edit" section on the right
  - **THEN:** Users see a checklist of best practices for editing.

### REQ-3-4 Delete Question
Question author can delete their own question if it has no answers or minimal engagement.

**Dependencies:** REQ-3-2, REQ-3-2.1

**Scenarios:**
- Delete Question (1)
  - **GIVEN:** User is on a question detail page and has permission to delete.
  - **WHEN:** Click "Delete" button below question
  - **THEN:** Show confirmation dialog explaining deletion implications
- Delete Question (2)
  - **GIVEN:** Deletion confirmation dialog is visible.
  - **WHEN:** Click "Confirm deletion"
  - **THEN:** Soft delete question (mark as deleted, preserve in database), redirect to homepage

### REQ-3-5 Vote on Question
Users can upvote or downvote questions to indicate quality and usefulness. Voting affects question author's reputation.

**Dependencies:** REQ-3-2

#### REQ-3-5.1 Upvote Question
Normal Flow: Upvote Question

**Dependencies:** REQ-2.2, REQ-3-2.1

**Scenarios:**
- Upvote Question (1)
  - **GIVEN:** User is logged in and viewing a question detail page.
  - **WHEN:** Click upvote arrow on question
  - **THEN:** Increment vote count by 1, highlight upvote arrow, add 10 reputation to question author
- Upvote Question (2)
  - **GIVEN:** The question is currently upvoted by the user.
  - **WHEN:** Click upvote arrow again
  - **THEN:** Remove upvote, decrement vote count, remove reputation bonus

#### REQ-3-5.2 Downvote Question
Normal Flow: Downvote Question

**Dependencies:** REQ-2.2, REQ-3-2.1

**Scenarios:**
- Downvote Question
  - **GIVEN:** User is logged in and viewing a question detail page.
  - **WHEN:** Click downvote arrow on question
  - **THEN:** Decrement vote count by 1, highlight downvote arrow, subtract 2 reputation from question author

## REQ-4 Answer Module
Integrated functionality within the Question Detail Page (REQ-3-2) that allows users to contribute solutions. It encompasses answer submission, evaluation, and organization. ![image](./reference/question-page.jpeg)

**Dependencies:** REQ-3, REQ-3-2

### REQ-4-1 Answer Submission (Your Answer)
A dedicated section at the bottom of the Question Detail Page for authenticated users to provide solutions. Features a Markdown editor consistent with the question creation interface.

**Dependencies:** REQ-2.2, REQ-3-2.1

**Scenarios:**
- Answer Submission (Your Answer) (1)
  - **GIVEN:** User is logged in and viewing a question detail page.
  - **WHEN:** Scroll to the "Your Answer" editor below the question and existing answers
  - **THEN:** The rich-text editor is visible and ready for input.
- Answer Submission (Your Answer) (2)
  - **GIVEN:** The 'Your Answer' editor is visible.
  - **WHEN:** Compose a response and click "Post Your Answer"
  - **THEN:** The new answer is appended to the list; the user is redirected or scrolled to their newly posted content. The answer appears in the profile page under "Answers" tab.

### REQ-4-2 Answer Evaluation (Voting)
Individual voting sidebars for each answer in the list, allowing the community to rank solutions by quality.

**Dependencies:** REQ-2.2, REQ-3-2.1

**Scenarios:**
- Answer Evaluation (Voting)
  - **GIVEN:** User is logged in and viewing a question detail page.
  - **WHEN:** Click the upvote/downvote arrows on an answer card
  - **THEN:** The answer's score updates; reputation is awarded/deducted from the answer author.

### REQ-4-3 Accepted Answer Selection
Special privilege for the question author to mark a single answer as the definitive solution, distinguished by a green checkmark.

**Dependencies:** REQ-2.2, REQ-3-2.1

**Scenarios:**
- Accepted Answer Selection
  - **GIVEN:** User is the question owner and is viewing the question detail page.
  - **WHEN:** Click the checkmark outline next to an answer
  - **THEN:** The answer is highlighted as accepted; the icon turns solid green.

### REQ-4-4 Answer List Controls & Sorting
Header section for the answers list displaying the total answer count and a "Sorted by" dropdown menu (High score, Date, etc.).

**Dependencies:** REQ-3-2.1

**Scenarios:**
- Answer List Controls & Sorting (1)
  - **GIVEN:** User is viewing the answers list on a question detail page.
  - **WHEN:** Click the "Sorted by" dropdown menu
  - **THEN:** Shows options like "Highest score", "Trending", and "Date modified".
- Answer List Controls & Sorting (2)
  - **GIVEN:** The sort options list is visible.
  - **WHEN:** Select a different sorting method
  - **THEN:** The list of answers reorders immediately according to the selection.

### REQ-4-5 Edit Answer
Answer author can edit their answers to improve clarity or add information.

**Dependencies:** REQ-4-1

#### REQ-4-5.1 Happy Path - Successfully Edit Answer
Normal Flow: Successfully Edit Answer

**Dependencies:** REQ-4-1

**Scenarios:**
- Happy Path - Successfully Edit Answer (1)
  - **GIVEN:** User is viewing their own answer.
  - **WHEN:** Click "Edit" link below your answer
  - **THEN:** Display answer editor with current content pre-filled.
- Happy Path - Successfully Edit Answer (2)
  - **GIVEN:** Answer editor is visible.
  - **WHEN:** Modify the answer body and provide an "Edit Summary" describing the change.
  - **THEN:** Input fields reflect changes.
  - **WHEN:** Click "Save edits"
  - **THEN:** Update answer content, append to revision history, and display "edited" timestamp on the post.

#### REQ-4-5.2 Error - Empty Answer Body
Exception Flow: Empty Answer Body

**Dependencies:** REQ-4-1

**Scenarios:**
- Error - Empty Answer Body
  - **GIVEN:** Answer editor is visible.
  - **WHEN:** Clear all text in the body and click "Save edits"
  - **THEN:** Show validation error "Body cannot be empty" and prevent submission.

#### REQ-4-5.3 Cancel Answer Editing
Normal Flow: Cancel Answer Editing

**Dependencies:** REQ-4-1

**Scenarios:**
- Cancel Answer Editing
  - **GIVEN:** Answer editor is visible.
  - **WHEN:** Modify text and then click "Cancel"
  - **THEN:** Close editor and return to the original answer view without saving changes.

### REQ-4-6 Delete Answer
Answer author can delete their own answer if not accepted.

**Dependencies:** REQ-4-1

**Scenarios:**
- Delete Answer (1)
  - **GIVEN:** User is viewing their own answer.
  - **WHEN:** Click "Delete" link below answer
  - **THEN:** Show confirmation dialog explaining the consequences.
- Delete Answer (2)
  - **GIVEN:** Deletion confirmation dialog is visible.
  - **WHEN:** Click "Confirm deletion"
  - **THEN:** Soft delete answer, remove from public display, and reverse any reputation changes associated with it.

## REQ-5 Comments Module
Users can add short comments to questions and answers for clarification, feedback, or minor additions.

**Dependencies:** REQ-3, REQ-4

### REQ-5-1 Add Comment on Question
Users can add comments to questions and answers with a 600 character limit.

**Dependencies:** None

#### REQ-5-1.1 Post Comment on Question or Answer
Normal Flow: Post Comment

**Dependencies:** REQ-2.2, REQ-3-2.1

**Scenarios:**
- Post Comment on Question or Answer (1)
  - **GIVEN:** User is logged in and viewing a question detail page.
  - **WHEN:** Click "Add a comment" link below question or answer
  - **THEN:** Display inline comment input field
- Post Comment on Question or Answer (2)
  - **GIVEN:** Inline comment input field is visible.
  - **WHEN:** Type comment (maximum 600 characters) and press Enter or click "Add Comment"
  - **THEN:** Add comment below post, display with commenter name and timestamp

#### REQ-5-1.2 View All Comments
Normal Flow: View All Comments

**Dependencies:** REQ-5-1.1

**Scenarios:**
- View All Comments
  - **GIVEN:** A post has more than 5 comments and is showing a collapsed comment list.
  - **WHEN:** Click "Show X more comments"
  - **THEN:** Expand to show all comments for that post

### REQ-5-2 Edit and Delete Comments
Comment authors can edit or delete their own comments within a time window.

**Dependencies:** None

#### REQ-5-2.1 Edit Comment
Normal Flow: Edit Comment

**Dependencies:** REQ-5-1.1

**Scenarios:**
- Edit Comment (1)
  - **GIVEN:** User can see their own comment within the editable time window.
  - **WHEN:** Click "Edit" link next to own comment (within 5 minutes of posting)
  - **THEN:** Convert comment to editable text field
- Edit Comment (2)
  - **GIVEN:** Comment is in edit mode.
  - **WHEN:** Modify text and press Enter
  - **THEN:** Update comment, show "edited" indicator

#### REQ-5-2.2 Delete Comment
Normal Flow: Delete Comment

**Dependencies:** REQ-5-1.1

**Scenarios:**
- Delete Comment
  - **GIVEN:** User can see their own comment.
  - **WHEN:** Click "Delete" icon next to own comment
  - **THEN:** Remove comment immediately without confirmation

### REQ-5-3 Upvote Comment
Users can upvote comments to indicate they are helpful or relevant. Comments cannot be downvoted.

**Dependencies:** REQ-5-1, REQ-5-1.2

**Scenarios:**
- Upvote Comment (1)
  - **GIVEN:** User can see a comment with an upvote control.
  - **WHEN:** Click upvote icon next to a comment
  - **THEN:** Increment comment upvote count by 1, highlight upvote icon
- Upvote Comment (2)
  - **GIVEN:** The comment is currently upvoted by the user.
  - **WHEN:** Click upvote icon again on same comment
  - **THEN:** Remove upvote, decrement count by 1, unhighlight icon

### REQ-5-4 Add Comment on Answer
Users can add comments to questions and answers with a 600 character limit.

**Dependencies:** REQ-2, REQ-3-2, REQ-2.2, REQ-3-2.1

**Scenarios:**
- Add Comment on Answer (1)
  - **GIVEN:** User is logged in and viewing a question detail page.
  - **WHEN:** Click "Add a comment" link below question or answer
  - **THEN:** Display inline comment input field
- Add Comment on Answer (2)
  - **GIVEN:** Inline comment input field is visible.
  - **WHEN:** Type comment (maximum 600 characters) and press Enter or click "Add Comment"
  - **THEN:** Add comment below post, display with commenter name and timestamp

### REQ-5-5 Reply to Comments
Users can reply to existing comments, creating threaded conversations. Replies are indented to show parent-child relationship.

**Dependencies:** REQ-2, REQ-3, REQ-3-2, REQ-2.2, REQ-3-2.1

**Scenarios:**
- Reply to Comments (1)
  - **GIVEN:** User is logged in and can see a comment thread.
  - **WHEN:** Click "Reply" link next to a comment
  - **THEN:** Display inline reply input field below the parent comment
- Reply to Comments (2)
  - **GIVEN:** Inline reply input field is visible.
  - **WHEN:** Type reply text and press Enter or click "Add Reply"
  - **THEN:** Add reply as child comment, indented below parent, showing "@username" mention of parent commenter

## REQ-6 Tags Module
![image](./reference/tags-page.jpeg) Tags categorize questions and enable filtering. Each tag has a name, description, question count, and can be followed by users.

**Dependencies:** REQ-3

### REQ-6.1 View All Tags
Normal Flow: View All Tags

**Dependencies:** REQ-1.1

**Scenarios:**
- View All Tags
  - **GIVEN:** User is on a question list page and can access site navigation.
  - **WHEN:** Click "Tags" in main navigation
  - **THEN:** Display paginated list of all tags with names, descriptions, and question counts, sorted by popularity

### REQ-6-1 Tag Detail Page
Displays all questions with a specific tag, tag description, and related tags.

**Dependencies:** REQ-6.1

**Scenarios:**
- Tag Detail Page
  - **GIVEN:** User can see a tag link.
  - **WHEN:** Click on a tag from tag list, question, or tag search
  - **THEN:** Display filtered question list showing only questions with that tag, with tag info header

### REQ-6-2 Follow Tags
Users can follow tags to customize their feed and get notifications about new questions.

**Dependencies:** REQ-2.2, REQ-6-1

**Scenarios:**
- Follow Tags (1)
  - **GIVEN:** User is logged in and viewing a tag detail page.
  - **WHEN:** Click "Watch tag" button on tag page
  - **THEN:** Add tag to user's followed tags, highlight tag in yellow on question lists
- Follow Tags (2)
  - **GIVEN:** Tag is being watched.
  - **WHEN:** Click "Watching" dropdown
  - **THEN:** "Unwatch tag" tooltip shows
  - **WHEN:** Click "Unwatch tag"
  - **THEN:** Button changed to "Watch tag"

## REQ-7 Search and Filter Module
![image](./reference/search-and-filter.jpeg) Comprehensive search functionality allowing users to find questions by keywords, tags, user, date range, and other criteria.

**Dependencies:** REQ-1

### REQ-7.1 Basic Search
Normal Flow: Basic Search

**Dependencies:** REQ-1.1

**Scenarios:**
- Basic Search
  - **GIVEN:** User can see the header search box.
  - **WHEN:** Enter keywords in search box in header
  - **THEN:** Display real-time search suggestions
  - **WHEN:** Press Enter or click search icon
  - **THEN:** Display search results page with matching questions, ranked by relevance

### REQ-7.2 Filter Questions by Tab
Normal Flow: Filter Questions by Tab

**Dependencies:** REQ-1.1

**Scenarios:**
- Filter Questions by Tab
  - **GIVEN:** User can see filter tabs on a question list page.
  - **WHEN:** Click filter tabs (Newest, Active, Bountied, Unanswered, Frequent)
  - **THEN:** Update question list based on selected filter criteria

### REQ-7.3 Create Custom Filter
Normal Flow: Create Custom Filter

**Dependencies:** REQ-1.1

**Scenarios:**
- Create Custom Filter (1)
  - **GIVEN:** User is on a question list page.
  - **WHEN:** Click on "Filter" button
  - **THEN:** More filter options in a "Filter by" container is shown
- Create Custom Filter (2)
  - **GIVEN:** Filter options panel is visible.
  - **WHEN:** Customize the filter by clicking on "Filter by" checkboxes
  - **THEN:** Checkboxes are checked
  - **WHEN:** Customize the filter by clicking on "Sorted by" radio buttons
  - **THEN:** One of the radio button is active
  - **WHEN:** Customize the filter by typing into "The following tags:" input box
  - **THEN:** Input field is populated
  - **WHEN:** Click "Save custom filter"
  - **THEN:** Create custom filter modal pops up
- Create Custom Filter (3)
  - **GIVEN:** Create custom filter modal is visible.
  - **WHEN:** Type name in "Filter title"
  - **THEN:** Input field is populated
  - **WHEN:** Click "Save filter"
  - **THEN:** Filtered question list is shown

## REQ-8 Reputation and Badges System
Gamification system tracking user contributions through reputation points and achievement badges. Reputation unlocks privileges at various thresholds.

**Dependencies:** REQ-2

### REQ-8.1 View Reputation History
Normal Flow: View Reputation History

**Dependencies:** REQ-2.3

**Scenarios:**
- View Reputation History
  - **GIVEN:** User has permission to view reputation history on the profile.
  - **WHEN:** Click "Reputation" tab on user profile
  - **THEN:** Display chronological list of reputation changes with reasons and linked posts

### REQ-8-1 Earn Badges
Users automatically earn badges for various achievements (first question, helpful answers, consistency, etc.).

**Dependencies:** None

#### REQ-8-1.1 Badge Award Notification
Normal Flow: Badge Award Notification

**Dependencies:** None

**Scenarios:**
- Badge Award Notification
  - **GIVEN:** User performs actions that meet a badge's criteria.
  - **WHEN:** Trigger badge criteria (e.g., receive 10 upvotes on answer)
  - **THEN:** Award badge to user, show notification popup, display on profile

#### REQ-8-1.2 View All Badges
Normal Flow: View All Badges

**Dependencies:** REQ-1.1

**Scenarios:**
- View All Badges
  - **GIVEN:** User can access site navigation.
  - **WHEN:** Click "Badges" in navigation or profile
  - **THEN:** Display categorized list of all available badges with descriptions and earn counts

## REQ-9 User Activity Feed
A comprehensive dashboard within the user profile for tracking all community contributions and engagement history. ![image](./reference/user-feed.jpeg)

**Dependencies:** REQ-2

### REQ-9.1 View Activity Tab
Normal Flow: View Activity Tab

**Dependencies:** REQ-2.3

**Scenarios:**
- View Activity Tab
  - **GIVEN:** User has permission to view the target user's activity.
  - **WHEN:** Navigate to user profile and click the "Activity" tab
  - **THEN:** Display the activity layout with a vertical navigation sidebar and content area.

### REQ-9-1 Activity Sidebar Navigation
Vertical menu in the Activity tab providing access to various content types: Summary, Answers, Questions, Tags, Articles, Badges, Following, Bounties, Reputation, All actions, Responses, and Votes.

**Dependencies:** REQ-9.1

**Scenarios:**
- Activity Sidebar Navigation
  - **GIVEN:** User is on the Activity tab and can see the activity sidebar.
  - **WHEN:** Click on different items in the activity sidebar
  - **THEN:** The right-side content area updates to reflect the selected category without full page reload.

### REQ-9-2 User Answers History
Displays a list of all answers provided by the user. Includes sorting by score, activity, or newest. Shows question titles and answer status (e.g., accepted).

**Dependencies:** REQ-9.1

**Scenarios:**
- User Answers History
  - **GIVEN:** User is on the Activity tab.
  - **WHEN:** Click "Answers" in the activity sidebar
  - **THEN:** Display paginated list of answers with sorting controls (Score, Activity, Newest).

### REQ-9-3 User Questions History
Lists all questions posted by the user. Includes metadata like votes, answers, and view counts for each question.

**Dependencies:** REQ-9.1

**Scenarios:**
- User Questions History
  - **GIVEN:** User is on the Activity tab.
  - **WHEN:** Click "Questions" in the activity sidebar
  - **THEN:** Display list of user questions with engagement metrics.

### REQ-9-4 Reputation and Engagement Tracking
Detailed view of reputation changes, badge earnings, and voting history. Provides a chronological log of how the user's standing has evolved.

**Dependencies:** REQ-9.1

**Scenarios:**
- Reputation and Engagement Tracking
  - **GIVEN:** User is on the Activity tab.
  - **WHEN:** Click "Reputation" or "Votes" in the sidebar
  - **THEN:** Show detailed logs of reputation points or voting actions (privately for votes).

### REQ-9-5 User Responses and Comments
Consolidated view of all comments and replies made by the user across questions and answers.

**Dependencies:** REQ-9.1

**Scenarios:**
- User Responses and Comments
  - **GIVEN:** User is on the Activity tab.
  - **WHEN:** Click "Responses" in the activity sidebar
  - **THEN:** Display a list of comments/replies linked to their respective parent posts.
