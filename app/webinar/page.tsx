import Layout from '../../components/Layout';

export default function WebinarPage() {
    return (
        <Layout showTasksPanel={false}>
            <div className="flex-1 flex items-center justify-center bg-white">
                <div className="text-center">
                    <h1 className="text-4xl font-semibold text-gray-800 mb-4">🎥 Webinar</h1>
                    <p className="text-gray-600">Webinar features coming soon</p>
                </div>
            </div>
        </Layout>
    );
}