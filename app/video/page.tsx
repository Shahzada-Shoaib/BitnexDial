import Layout from '../../components/Layout';

export default function VideoPage() {
    return (
        <Layout showTasksPanel={false}>
            <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-800">
                <div className="text-center">
                    <h1 className="text-4xl font-semibold text-gray-800 dark:text-gray-100 mb-4">📹 Video</h1>
                    <p className="text-gray-600 dark:text-gray-400">Video communication features coming soon</p>
                </div>
            </div>
        </Layout>
    );
}