import Layout from '../../components/Layout';

export default function AppsPage() {
    return (
        <Layout showTasksPanel={false}>
            <div className="flex-1 flex items-center justify-center bg-white">
                <div className="text-center">
                    <h1 className="text-4xl font-semibold text-gray-800 mb-4">⊞ Apps</h1>
                    <p className="text-gray-600">App marketplace coming soon</p>
                </div>
            </div>
        </Layout>
    );
}