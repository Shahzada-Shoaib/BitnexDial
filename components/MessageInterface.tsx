import { FaFolderOpen } from "react-icons/fa";
import { LiaEdit } from "react-icons/lia";
import { MdNotificationAdd } from "react-icons/md";
import { TbDotsVertical } from "react-icons/tb";
import { BiSearchAlt } from "react-icons/bi";
import { PiStarThin } from "react-icons/pi";
import { MdKeyboardArrowUp } from "react-icons/md";
import { RiTelegramLine } from "react-icons/ri";
import { HiMiniPlus } from "react-icons/hi2";
import { RiTeamLine } from "react-icons/ri";
import { RiPokerDiamondsLine } from "react-icons/ri";
import { BiHelpCircle } from "react-icons/bi";
import { FiCamera } from "react-icons/fi";
import { CiFaceSmile } from "react-icons/ci";

export default function MessageInterface() {
    return (
        <div className="flex w-full h-[90vh] mx-auto">
            {/* Left Panel - Message List */}
            <div className="w-[18%] rounded-t-2xl bg-[#D3E9E7]  h-full flex flex-col">
                {/* Header */}
                <div className="p-4 bg-[#D3E9E7] rounded-t-2xl">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex py-4 items-center border-b border-[#3778D6] justify-between w-full">
                            <h2 className="text-lg font-bold mr-2 pl-1.5  flex items-center">
                                Messages
                            </h2>
                            <div className="flex pr-1.5 items-center  space-x-2">
                                <button className="text-[#607D8B] text-xl cursor-pointer"><FaFolderOpen /></button>
                                <button className="text-[#607D8B] text-xl cursor-pointer "><LiaEdit /></button>

                                <button className="text-[#607D8B] text-xl cursor-pointer "><MdNotificationAdd /></button>
                                <button className="text-[#607D8B] text-xl cursor-pointer "><TbDotsVertical /></button>
                            </div>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="mb-3 flex justify-between  border-b py-2 border-[#3778D6]">

                        <div className='w-2/4 flex'>
                            <span className='ml-3 self-center text-xl text-[#929292]' style={{ transform: 'scaleX(-1)' }}>
                                <BiSearchAlt />
                            </span>
                            <input
                                type="text"
                                placeholder="Search Taxes"
                                className=" p-2  text-sm  border-gray-200 rounded-md focus:outline-none focus:border-gray-200 focus:border-b-2 focus:border-b-[#929292] transition-all duration-200"
                            /></div>

                        {/* Filter buttons */}
                        <div className="flex ">
                            <button className="text-sm font-bold pl-2 text-[#3778D6]  cursor-pointer">
                                ALL
                            </button>
                            <button className="text-sm font-bold  px-2 py-1 cursor-pointer" >
                                UNREAD
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {/* Favorites Section */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-medium text-gray-700 flex items-center">
                                <span className="mr-2">⭐</span>
                                FAVORITES
                            </h3>
                            <button className="text-[#3778d6] hover:text-gray-600 text-2xl"><MdKeyboardArrowUp /></button>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center p-2 hover:bg-white rounded-lg cursor-pointer ml-4">
                                <div className="w-2 h-2 bg-gray-400 rounded-full mr-3"></div>
                                <span className="text-sm">Steve Walsh (me)</span>
                            </div>
                        </div>
                    </div>

                    {/* Direct Messages Section */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-medium text-gray-700 flex items-center">
                                <span className="mr-2 text-[#3778d6] hover:text-gray-600 text-2xl"><RiTelegramLine /></span>
                                DIRECT MESSAGE
                            </h3>
                            <div className="flex items-center space-x-2">
                                <button className="text-[#3778d6] hover:text-gray-600 text-2xl"><HiMiniPlus /></button>
                                <button className="text-[#3778d6] hover:text-gray-600 text-2xl"><MdKeyboardArrowUp /></button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center p-2 hover:bg-white rounded-lg cursor-pointer">
                                <div className="w-2 h-2 bg-gray-400 rounded-full mr-3"></div>
                                <span className="text-sm ml-4">Sublime Dispatch</span>
                            </div>
                            <div className="flex items-center p-2 hover:bg-white rounded-lg cursor-pointer">
                                <div className="w-2 h-2 bg-gray-400 rounded-full mr-3"></div>
                                <span className="text-sm ml-4">Dignity Dispatch</span>
                            </div>
                        </div>
                    </div>

                    {/* Teams Section */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-medium text-gray-700 flex items-center">
                                <span className="mr-2 text-[#3778d6] hover:text-gray-600 text-2xl"><RiTeamLine /></span>
                                Teams
                            </h3>
                            <div className="flex items-center space-x-2">
                                <button className="text-[#3778d6] hover:text-gray-600 text-2xl"><HiMiniPlus /></button>
                                <button className="text-[#3778d6] hover:text-gray-600 text-2xl"><MdKeyboardArrowUp /></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 bg-white flex flex-col">
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-200 bg-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <h2 className="text-lg font-medium">Steve Walsh (me)</h2>
                            <span className="ml-2 text-yellow-500">⭐</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button className="text-[#3778d6] hover:text-gray-600 text-2xl"><RiPokerDiamondsLine></RiPokerDiamondsLine></button>
                            <button className="text-[#3778d6] hover:text-gray-600 text-2xl"><BiHelpCircle /></button>
                            <button className="text-[#3778d6] hover:text-gray-600 text-2xl"><TbDotsVertical /></button>
                        </div>
                    </div>
                </div>

                {/* Chat Content */}
                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="text-center max-w-md">
                        {/* Illustration */}
                        <div className="mb-8">
                            <img src="/Message.png" alt="Message illustration" className="mx-auto max-w-full h-auto" />
                        </div>

                        <div className="text-center space-y-6">
                            <div className="space-y-4">
                                <button className="bg-[#D3E9E7] text-[#3778d6] px-6 py-2 rounded-full text-sm font-medium hover:bg-teal-200 transition-colors">
                                    Share a File
                                </button>
                                <button className="bg-[#D3E9E7] text-[#3778d6] px-6 py-2 rounded-full text-sm font-medium hover:bg-teal-200 transition-colors mx-4">
                                    Create a Task
                                </button>
                                <button className="bg-[#D3E9E7] text-[#3778d6] px-6 py-2 rounded-full text-sm font-medium hover:bg-teal-200 transition-colors">
                                    Add an App
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Message Input */}
                <div className="p-4 border-t border-gray-200 bg-teal-50">
                    <div className="flex items-center">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                placeholder="Message ..."
                                className="w-full p-3 pl-12 pr-20 bg-white border border-gray-300 rounded-lg text-sm"
                            />
                            {/* Left side icon */}
                            <div className="absolute left-3 top-3">
                                <button className="text-gray-400 hover:text-gray-600"><CiFaceSmile /></button>
                            </div>
                            {/* Right side icons */}
                            <div className="absolute right-3 top-3 flex items-center space-x-2">
                                <button className="text-gray-400 hover:text-gray-600"><FiCamera /></button>
                                <button className="text-gray-400 hover:text-gray-600"><TbDotsVertical /></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
}