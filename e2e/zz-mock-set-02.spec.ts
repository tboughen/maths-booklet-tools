import {registerPaper,registerMobile,registerDownloads} from "./mock-set-02-support";
for(const component of ["1F","2F","3F","1H","2H","3H"]){registerPaper(component);registerDownloads(component);}
registerMobile();
