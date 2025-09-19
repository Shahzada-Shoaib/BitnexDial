// app/help/page.tsx
import Layout from '../../components/Layout';
import HelpInterface from '../../components/settingsInterface';

export default function HelpPage() {
    return (
        <Layout showTasksPanel={false}>
            <HelpInterface />
        </Layout>
    );
}