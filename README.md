# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

Steps to run the files
1) Clone the repo
git clone <YOUR_REPO_URL>.git
cd <YOUR_REPO_FOLDER>

2) Install Node.js (pick one option)
Option A — NodeSource (current Node 20)
sudo apt-get update
curl -fsSL https://deb.nodesource.com/setup_20.x -o nodesource_setup.sh
sudo bash nodesource_setup.sh
rm nodesource_setup.sh
sudo apt-get install -y nodejs

Option B — Ubuntu repo (simplest, may be older)
sudo apt-get update
sudo apt-get install -y nodejs npm

Option C — Snap (also current)
sudo snap install node --classic --channel=20


Verify:

node -v
npm -v

3) Install dependencies
npm ci
# If there is no package-lock.json:
# npm install

4) Run the app (Vite dev server)
npm run dev -- --host 0.0.0.0 --port 5173


Open: http://localhost:5173

(Optional) Production build + preview
npm run build
npm run preview -- --host 0.0.0.0 --port 5173


Tip: If port 5173 is busy, change the port number in the command.
