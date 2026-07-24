    I want tohave clean destination for addition. What is done, has to stay intact, not to ruin basics.
    reference: Please read as the reference ~/internal-AI-workloads-nextjs
    I want to have much better flow: it has to be simple and inteligent as possible, App has is made in order to be enhanced by developer who install this npm library in that app. The point is to have add tool page, and everything done by adding the tool is in app - flow is made - new tool is in registry by clicking the button, can be seen in personal-chat page (globalcontext is impelementing the tools with the state and function is made as the skill dedicated to new tool made. If it can be simpler but not to have the code which is giving complexity than that doesnot have to be the skill.. I do not fetch file system of the app, fs library for writing in file in app). Please tell e you do not like something, ask for clarification. Do not rewrite, make new. Please write down what is made in docs/DONE.md (it doesnot go into publish)
    Please do everything in accordance to docs/CONTINUE.md and docs/TODO.md
    I) There is the page /internal-AI-workloads-nextjs/app/chatai/page.tsx I want to have as addition here. Please rename chatai to personal-chat/page.tsx. It will be chating with giving instructions, tools and chosing response (already made in good manner in reference)
    II) make mcp dashboard alike mcpserver, calling api/mcpserver. This component is modular: every function and/or api call is in separate file in @lib or other place. Remember that even when writing the code in api/route.ts when you call other api, session state, other function it is in separate file and response or export is imported in route.ts.
    • -This pages for mcpdashboard and chatai are importing component which is importing everything else as response and/or import, including context from global context.
II/ III) page new-tool/page.tsx
    • 1. call agent in mcp-dashboard and have a  link to page smart-chat (new page for chat- in order not to ruin basic functionity in chat/page.tsx)
    • 2. that smart-chat is supoose to have caling the function to trace if prompt is related to any tool (listTools). If so response is calling the tool first, print to user which tool is called, response from the tool can be used as next prompt, and user additionaly can choose to continue running the same first prompt using regular chat in the same smart-chat/ Reusability is make, so only functionality where upon prompt app decide if one of the tools is better to be used in response to prompt
    - This is the todo for next session or other session ater next. It stays as the future develpment not in this plan: that first prompt is saved I memory  which can be deleted by user. Memory is sqlite.
    • 3. component for making new tool made by form
    • 4. component for making new tool by uploading document in .docx, .md, .pdf,, .txt extension (see the reference, it is already made)
    - 5. neww tool is made from skill (template is alike Claude is making new skill using skill)
    • 6. Implementing making new tool and registering made in user session and globalcontext, and dedicated table in sqlite for the user loggedin
    
  important:
  - sw.js in public/sw.js interfere with running Next.js and is not recomended to be present. It has to be removed on deep level with command.
