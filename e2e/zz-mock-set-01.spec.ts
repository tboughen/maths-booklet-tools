import {registerPaper,registerDownloads,registerMobile} from "./mock-set-01-support";
for(const component of ["1H","2H","3H"])registerPaper(component);
registerDownloads();
registerMobile();
