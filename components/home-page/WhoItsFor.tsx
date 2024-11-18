import React, { useState, useEffect } from 'react';
import { Users, School, Search, Building2, FileCheck, Brain, ChevronLeft, ChevronRight } from 'lucide-react';

const WhoItsFor = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const userTypes = [
   
    {
      icon: School,
      title: "Educators",
      description: "Efficiently validate student submissions and academic work, saving hours of manual verification time",
      example: "Like Prof. Johnson, who caught 23 incorrect citations in one semester using automated verification"
    },
    {
      icon: Brain,
      title: "Content Creators",
      description: "Verify AI-generated references instantly to ensure your content maintains credibility and accuracy",
      example: "Like Sarah, who used SourceVerify to validate 200+ citations in her AI research blog in just minutes"
    },
    {
      icon: Search,
      title: "Reviewers",
      description: "Streamline the peer review process by quickly verifying citations and references in submitted papers",
      example: "Like Nature's peer reviewers, who reduced reference checking time by 75% using SourceVerify"
    },
    {
      icon: Building2,
      title: "Research Funders",
      description: "Evaluate grant proposals with confidence by automatically validating publication records and citations",
      example: "Like the NSF, who verified 1000+ researcher publications across 50 grant proposals in one day"
    },
    {
      icon: Users,
      title: "HR Teams",
      description: "Verify academic credentials and publication lists when evaluating candidates' CVs and resumes",
      example: "Like Tesla's HR team, who validated 100+ researcher CVs for their AI division in hours, not weeks"
    },
    {
      icon: FileCheck,
      title: "Publishers",
      description: "Maintain publication integrity by catching incorrect or fabricated references before publication",
      example: "Like IEEE, who caught 45 incorrect citations before publication using automated verification"
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isPaused) {
        setActiveIndex((current) => 
          current === userTypes.length - 1 ? 0 : current + 1
        );
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isPaused]);

  const handlePrevious = () => {
    setActiveIndex((current) => 
      current === 0 ? userTypes.length - 1 : current - 1
    );
  };

  const handleNext = () => {
    setActiveIndex((current) => 
      current === userTypes.length - 1 ? 0 : current + 1
    );
  };

  return (
    <section className="max-w-6xl mx-auto px-8 py-16">
      <h2 className="text-4xl font-bold text-center mb-4">
        <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 inline-block text-transparent bg-clip-text">
          Who It's For
        </span>
      </h2>
      
      <p className="text-xl text-indigo-300 text-center mb-16 max-w-2xl mx-auto">
        From content creation to academic integrity, SourceVerify helps professionals across industries validate references with confidence
      </p>

      {/* Featured Card Carousel */}
      <div 
        className="relative mx-auto max-w-2xl mb-16"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="overflow-hidden rounded-2xl">
          <div className="relative">
            {userTypes.map((type, index) => (
              <div
                key={index}
                className={`transform transition-all duration-500 ${
                  index === activeIndex 
                    ? 'opacity-100 translate-x-0' 
                    : 'opacity-0 absolute top-0 translate-x-full'
                }`}
              >
                <div className="bg-gray-800/50 backdrop-blur-sm p-8 border border-indigo-500/20">
                  <div className="flex items-center mb-6">
                    <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 p-4 rounded-full">
                      <type.icon className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h3 className="text-2xl text-white font-semibold ml-4">{type.title}</h3>
                  </div>
                  <p className="text-lg text-indigo-300 mb-4">{type.description}</p>
                  {/*<p className="text-sm text-indigo-400 italic">{type.example}</p>*/}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Buttons */}
        <button
          onClick={handlePrevious}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 bg-gray-800/50 p-2 rounded-full hover:bg-gray-700/50 transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-indigo-400" />
        </button>
        <button
          onClick={handleNext}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 bg-gray-800/50 p-2 rounded-full hover:bg-gray-700/50 transition-colors"
        >
          <ChevronRight className="w-6 h-6 text-indigo-400" />
        </button>

        {/* Dot Indicators */}
        <div className="flex justify-center gap-2 mt-4">
          {userTypes.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === activeIndex 
                  ? 'bg-indigo-400 w-4' 
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
            />
          ))}
        </div>
      </div>

    </section>
  )
}

export default WhoItsFor