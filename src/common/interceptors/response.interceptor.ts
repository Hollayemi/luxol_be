import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((result) => {
        // Allow controllers to opt out / customize via { message, data }
        if (result && typeof result === "object" && "data" in result) {
          return {
            success: true,
            message: result.message ?? "OK",
            data: result.data,
          };
        }
        return { success: true, message: "OK", data: result ?? null };
      }),
    );
  }
}